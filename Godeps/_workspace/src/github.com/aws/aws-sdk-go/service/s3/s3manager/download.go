package s3manager

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

// DefaultDownloadPartSize is the default range of bytes to get at a time when
// using Download().
const DefaultDownloadPartSize = 1024 * 1024 * 5

// DefaultDownloadConcurrency is the default number of goroutines to spin up
// when using Download().
const DefaultDownloadConcurrency = 5

// The Downloader structure that calls Download(). It is safe to call Download()
// on this structure for multiple objects and across concurrent goroutines.
// Mutating the Downloader's properties is not safe to be done concurrently.
type Downloader struct {
	// The buffer size (in bytes) to use when buffering data into chunks and
	// sending them as parts to S3. The minimum allowed part size is 5MB, and
	// if this value is set to zero, the DefaultPartSize value will be used.
	PartSize int64

	// The number of goroutines to spin up in parallel when sending parts.
	// If this is set to zero, the DefaultDownloadConcurrency value will be used.
	Concurrency int

	// An S3 client to use when performing downloads.
	S3 s3iface.S3API
}

// NewDownloader creates a new Downloader instance to downloads objects from
// S3 in concurrent chunks. Pass in additional functional options  to customize
// the downloader behavior. Requires a client.ConfigProvider in order to create
// a S3 service client. The session.Session satisfies the client.ConfigProvider
// interface.
//
// Example:
//     // The session the S3 Downloader will use
//     sess, err := session.NewSession()
//
//     // Create a downloader with the session and default options
//     downloader := s3manager.NewDownloader(sess)
//
//     // Create a downloader with the session and custom options
//     downloader := s3manager.NewDownloader(sess, func(d *s3manager.Uploader) {
//          d.PartSize = 64 * 1024 * 1024 // 64MB per part
//     })
func NewDownloader(c client.ConfigProvider, options ...func(*Downloader)) *Downloader {
	d := &Downloader{
		S3:          s3.New(c),
		PartSize:    DefaultDownloadPartSize,
		Concurrency: DefaultDownloadConcurrency,
	}
	for _, option := range options {
		option(d)
	}

	return d
}

// NewDownloaderWithClient creates a new Downloader instance to downloads
// objects from S3 in concurrent chunks. Pass in additional functional
// options to customize the downloader behavior. Requires a S3 service client
// to make S3 API calls.
//
// Example:
//     // The session the S3 Downloader will use
//     sess, err := session.NewSession()
//
//     // The S3 client the S3 Downloader will use
//     s3Svc := s3.new(sess)
//
//     // Create a downloader with the s3 client and default options
//     downloader := s3manager.NewDownloaderWithClient(s3Svc)
//
//     // Create a downloader with the s3 client and custom options
//     downloader := s3manager.NewDownloaderWithClient(s3Svc, func(d *s3manager.Uploader) {
//          d.PartSize = 64 * 1024 * 1024 // 64MB per part
//     })
func NewDownloaderWithClient(svc s3iface.S3API, options ...func(*Downloader)) *Downloader {
	d := &Downloader{
		S3:          svc,
		PartSize:    DefaultDownloadPartSize,
		Concurrency: DefaultDownloadConcurrency,
	}
	for _, option := range options {
		option(d)
	}

	return d
}

// Download downloads an object in S3 and writes the payload into w using
// concurrent GET requests.
//
// Additional functional options can be provided to configure the individual
// upload. These options are copies of the Uploader instance Upload is called from.
// Modifying the options will not impact the original Uploader instance.
//
// It is safe to call this method concurrently across goroutines.
//
// The w io.WriterAt can be satisfied by an os.File to do multipart concurrent
// downloads, or in memory []byte wrapper using aws.WriteAtBuffer.
func (d Downloader) Download(w io.WriterAt, input *s3.GetObjectInput, options ...func(*Downloader)) (n int64, err error) {
	impl := downloader{w: w, in: input, ctx: d}

	for _, option := range options {
		option(&impl.ctx)
	}

	return impl.download()
}

// downloader is the implementation structure used internally by Downloader.
type downloader struct {
	ctx Downloader

	in *s3.GetObjectInput
	w  io.WriterAt

	wg sync.WaitGroup
	m  sync.Mutex

	pos        int64
	totalBytes int64
	written    int64
	err        error
}

// init initializes the downloader with default options.
func (d *downloader) init() {
	d.totalBytes = -1

	if d.ctx.Concurrency == 0 {
		d.ctx.Concurrency = DefaultDownloadConcurrency
	}

	if d.ctx.PartSize == 0 {
		d.ctx.PartSize = DefaultDownloadPartSize
	}
}

// download performs the implementation of the object download across ranged
// GETs.
func (d *downloader) download() (n int64, err error) {
	d.init()

	// Spin off first worker to check additional header information
	d.getChunk()

	if total := d.getTotalBytes(); total >= 0 {
		// Spin up workers
		ch := make(chan dlchunk, d.ctx.Concurrency)

		for i := 0; i < d.ctx.Concurrency; i++ {
			d.wg.Add(1)
			go d.downloadPart(ch)
		}

		// Assign work
		for d.getErr() == nil {
			if d.pos >= total {
				break // We're finished queuing chunks
			}

			// Queue the next range of bytes to read.
			ch <- dlchunk{w: d.w, start: d.pos, size: d.ctx.PartSize}
			d.pos += d.ctx.PartSize
		}

		// Wait for completion
		close(ch)
		d.wg.Wait()
	} else {
		// Checking if we read anything new
		for d.err == nil {
			d.getChunk()
		}

		// We expect a 416 error letting us know we are done downloading the
		// total bytes. Since we do not know the content's length, this will
		// keep grabbing chunks of data until the range of bytes specified in
		// the request is out of range of the content. Once, this happens, a
		// 416 should occur.
		e, ok := d.err.(awserr.RequestFailure)
		if ok && e.StatusCode() == http.StatusRequestedRangeNotSatisfiable {
			d.err = nil
		}
	}

	// Return error
	return d.written, d.err
}

// downloadPart is an individual goroutine worker reading from the ch channel
// and performing a GetObject request on the data with a given byte range.
//
// If this is the first worker, this operation also resolves the total number
// of bytes to be read so that the worker manager knows when it is finished.
func (d *downloader) downloadPart(ch chan dlchunk) {
	defer d.wg.Done()
	for {
		chunk, ok := <-ch
		if !ok {
			break
		}
		d.downloadChunk(chunk)
	}
}

// getChunk grabs a chunk of data from the body.
// Not thread safe. Should only used when grabbing data on a single thread.
func (d *downloader) getChunk() {
	chunk := dlchunk{w: d.w, start: d.pos, size: d.ctx.PartSize}
	d.pos += d.ctx.PartSize
	d.downloadChunk(chunk)
}

// downloadChunk downloads the chunk froom s3
func (d *downloader) downloadChunk(chunk dlchunk) {
	if d.getErr() != nil {
		return
	}
	// Get the next byte range of data
	in := &s3.GetObjectInput{}
	awsutil.Copy(in, d.in)
	rng := fmt.Sprintf("bytes=%d-%d",
		chunk.start, chunk.start+chunk.size-1)
	in.Range = &rng

	req, resp := d.ctx.S3.GetObjectRequest(in)
	req.Handlers.Build.PushBack(request.MakeAddToUserAgentFreeFormHandler("S3Manager"))
	err := req.Send()

	if err != nil {
		d.setErr(err)
	} else {
		d.setTotalBytes(resp) // Set total if not yet set.

		n, err := io.Copy(&chunk, resp.Body)
		resp.Body.Close()

		if err != nil {
			d.setErr(err)
		}
		d.incrWritten(n)
	}
}

// getTotalBytes is a thread-safe getter for retrieving the total byte status.
func (d *downloader) getTotalBytes() int64 {
	d.m.Lock()
	defer d.m.Unlock()

	return d.totalBytes
}

// setTotalBytes is a thread-safe setter for setting the total byte status.
// Will extract the object's total bytes from the Content-Range if the file
// will be chunked, or Content-Length. Content-Length is used when the response
// does not include a Content-Range. Meaning the object was not chunked. This
// occurs when the full file fits within the PartSize directive.
func (d *downloader) setTotalBytes(resp *s3.GetObjectOutput) {
	d.m.Lock()
	defer d.m.Unlock()

	if d.totalBytes >= 0 {
		return
	}

	if resp.ContentRange == nil {
		// ContentRange is nil when the full file contents is provied, and
		// is not chunked. Use ContentLength instead.
		if resp.ContentLength != nil {
			d.totalBytes = *resp.ContentLength
			return
		}
	} else {
		parts := strings.Split(*resp.ContentRange, "/")

		total := int64(-1)
		var err error
		// Checking for whether or not a numbered total exists
		// If one does not exist, we will assume the total to be -1, undefined,
		// and sequentially download each chunk until hitting a 416 error
		totalStr := parts[len(parts)-1]
		if totalStr != "*" {
			total, err = strconv.ParseInt(totalStr, 10, 64)
			if err != nil {
				d.err = err
				return
			}
		}

		d.totalBytes = total
	}
}

func (d *downloader) incrWritten(n int64) {
	d.m.Lock()
	defer d.m.Unlock()

	d.written += n
}

// getErr is a thread-safe getter for the error object
func (d *downloader) getErr() error {
	d.m.Lock()
	defer d.m.Unlock()

	return d.err
}

// setErr is a thread-safe setter for the error object
func (d *downloader) setErr(e error) {
	d.m.Lock()
	defer d.m.Unlock()

	d.err = e
}

// dlchunk represents a single chunk of data to write by the worker routine.
// This structure also implements an io.SectionReader style interface for
// io.WriterAt, effectively making it an io.SectionWriter (which does not
// exist).
type dlchunk struct {
	w     io.WriterAt
	start int64
	size  int64
	cur   int64
}

// Write wraps io.WriterAt for the dlchunk, writing from the dlchunk's start
// position to its end (or EOF).
func (c *dlchunk) Write(p []byte) (n int, err error) {
	if c.cur >= c.size {
		return 0, io.EOF
	}

	n, err = c.w.WriteAt(p, c.start+c.cur)
	c.cur += int64(n)

	return
}
