package imguploader

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"io"
	"io/ioutil"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

type AzureBlobUploader struct {
	account_name   string
	account_key    string
	container_name string
	log            log.Logger
}

func NewAzureBlobUploader(account_name string, account_key string, container_name string) *AzureBlobUploader {
	return &AzureBlobUploader{
		account_name:   account_name,
		account_key:    account_key,
		container_name: container_name,
		log:            log.New("azureBlobUploader"),
	}
}

// Receive path of image on disk and return azure blob url
func (az *AzureBlobUploader) Upload(ctx context.Context, imageDiskPath string) (string, error) {
	// setup client
	blob := NewStorageClient(az.account_name, az.account_key)

	file, err := os.Open(imageDiskPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	randomFileName, err := util.GetRandomString(30)
	if err != nil {
		return "", err
	}

	randomFileName += pngExt
	// upload image
	az.log.Debug("Uploading image to azure_blob", "container_name", az.container_name, "blob_name", randomFileName)
	resp, err := blob.FileUpload(ctx, az.container_name, randomFileName, file)
	if err != nil {
		return "", err
	}

	if resp.StatusCode > 400 && resp.StatusCode < 600 {
		body, _ := ioutil.ReadAll(io.LimitReader(resp.Body, 1<<20))
		aerr := &Error{
			Code:   resp.StatusCode,
			Status: resp.Status,
			Body:   body,
			Header: resp.Header,
		}
		aerr.parseXML()
		resp.Body.Close()
		return "", aerr
	}

	url := fmt.Sprintf("https://%s.blob.core.windows.net/%s/%s", az.account_name, az.container_name, randomFileName)
	return url, nil
}

// --- AZURE LIBRARY
type Blobs struct {
	XMLName xml.Name `xml:"EnumerationResults"`
	Items   []Blob   `xml:"Blobs>Blob"`
}

type Blob struct {
	Name     string   `xml:"Name"`
	Property Property `xml:"Properties"`
}

type Property struct {
	LastModified  string `xml:"Last-Modified"`
	Etag          string `xml:"Etag"`
	ContentLength int    `xml:"Content-Length"`
	ContentType   string `xml:"Content-Type"`
	BlobType      string `xml:"BlobType"`
	LeaseStatus   string `xml:"LeaseStatus"`
}

type Error struct {
	Code   int
	Status string
	Body   []byte
	Header http.Header

	AzureCode string
}

func (e *Error) Error() string {
	return fmt.Sprintf("status %d: %s", e.Code, e.Body)
}

func (e *Error) parseXML() {
	var xe xmlError
	_ = xml.NewDecoder(bytes.NewReader(e.Body)).Decode(&xe)
	e.AzureCode = xe.Code
}

type xmlError struct {
	XMLName xml.Name `xml:"Error"`
	Code    string
	Message string
}

const ms_date_layout = "Mon, 02 Jan 2006 15:04:05 GMT"
const version = "2017-04-17"

type StorageClient struct {
	Auth      *Auth
	Transport http.RoundTripper
}

func (c *StorageClient) transport() http.RoundTripper {
	if c.Transport != nil {
		return c.Transport
	}
	return http.DefaultTransport
}

func NewStorageClient(account, accessKey string) *StorageClient {
	return &StorageClient{
		Auth: &Auth{
			account,
			accessKey,
		},
		Transport: nil,
	}
}

func (c *StorageClient) absUrl(format string, a ...interface{}) string {
	part := fmt.Sprintf(format, a...)
	return fmt.Sprintf("https://%s.blob.core.windows.net/%s", c.Auth.Account, part)
}

func copyHeadersToRequest(req *http.Request, headers map[string]string) {
	for k, v := range headers {
		req.Header[k] = []string{v}
	}
}

func (c *StorageClient) FileUpload(ctx context.Context, container, blobName string, body io.Reader) (*http.Response, error) {
	blobName = escape(blobName)
	extension := strings.ToLower(path.Ext(blobName))
	contentType := mime.TypeByExtension(extension)
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(body); err != nil {
		return nil, err
	}
	req, err := http.NewRequest(
		"PUT",
		c.absUrl("%s/%s", container, blobName),
		buf,
	)
	if err != nil {
		return nil, err
	}
	if ctx != nil {
		req = req.WithContext(ctx)
	}

	copyHeadersToRequest(req, map[string]string{
		"x-ms-blob-type": "BlockBlob",
		"x-ms-date":      time.Now().UTC().Format(ms_date_layout),
		"x-ms-version":   version,
		"Accept-Charset": "UTF-8",
		"Content-Type":   contentType,
		"Content-Length": strconv.Itoa(buf.Len()),
	})

	if err := c.Auth.SignRequest(req); err != nil {
		return nil, err
	}

	return c.transport().RoundTrip(req)
}

func escape(content string) string {
	content = url.QueryEscape(content)
	// the Azure's behavior uses %20 to represent whitespace instead of + (plus)
	content = strings.Replace(content, "+", "%20", -1)
	// the Azure's behavior uses slash instead of + %2F
	content = strings.Replace(content, "%2F", "/", -1)

	return content
}

type Auth struct {
	Account string
	Key     string
}

func (a *Auth) SignRequest(req *http.Request) error {
	strToSign := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s",
		strings.ToUpper(req.Method),
		tryget(req.Header, "Content-Encoding"),
		tryget(req.Header, "Content-Language"),
		tryget(req.Header, "Content-Length"),
		tryget(req.Header, "Content-MD5"),
		tryget(req.Header, "Content-Type"),
		tryget(req.Header, "Date"),
		tryget(req.Header, "If-Modified-Since"),
		tryget(req.Header, "If-Match"),
		tryget(req.Header, "If-None-Match"),
		tryget(req.Header, "If-Unmodified-Since"),
		tryget(req.Header, "Range"),
		a.canonicalizedHeaders(req),
		a.canonicalizedResource(req),
	)
	decodedKey, _ := base64.StdEncoding.DecodeString(a.Key)

	sha256 := hmac.New(sha256.New, decodedKey)
	if _, err := sha256.Write([]byte(strToSign)); err != nil {
		return err
	}

	signature := base64.StdEncoding.EncodeToString(sha256.Sum(nil))

	copyHeadersToRequest(req, map[string]string{
		"Authorization": fmt.Sprintf("SharedKey %s:%s", a.Account, signature),
	})

	return nil
}

func tryget(headers map[string][]string, key string) string {
	// We default to empty string for "0" values to match server side behavior when generating signatures.
	if len(headers[key]) > 0 { // && headers[key][0] != "0" { //&& key != "Content-Length" {
		return headers[key][0]
	}
	return ""
}

//
// The following is copied ~95% verbatim from:
//  http://github.com/loldesign/azure/ -> core/core.go
//

/*
Based on Azure docs:
  Link: http://msdn.microsoft.com/en-us/library/windowsazure/dd179428.aspx#Constructing_Element

  1) Retrieve all headers for the resource that begin with x-ms-, including the x-ms-date header.
  2) Convert each HTTP header name to lowercase.
  3) Sort the headers lexicographically by header name, in ascending order. Note that each header may appear only once in the string.
  4) Unfold the string by replacing any breaking white space with a single space.
  5) Trim any white space around the colon in the header.
  6) Finally, append a new line character to each canonicalized header in the resulting list. Construct the CanonicalizedHeaders string by concatenating all headers in this list into a single string.
*/
func (a *Auth) canonicalizedHeaders(req *http.Request) string {
	var buffer bytes.Buffer

	for key, value := range req.Header {
		lowerKey := strings.ToLower(key)

		if strings.HasPrefix(lowerKey, "x-ms-") {
			if buffer.Len() == 0 {
				buffer.WriteString(fmt.Sprintf("%s:%s", lowerKey, value[0]))
			} else {
				buffer.WriteString(fmt.Sprintf("\n%s:%s", lowerKey, value[0]))
			}
		}
	}

	split := strings.Split(buffer.String(), "\n")
	sort.Strings(split)

	return strings.Join(split, "\n")
}

/*
Based on Azure docs
  Link: http://msdn.microsoft.com/en-us/library/windowsazure/dd179428.aspx#Constructing_Element

1) Beginning with an empty string (""), append a forward slash (/), followed by the name of the account that owns the resource being accessed.
2) Append the resource's encoded URI path, without any query parameters.
3) Retrieve all query parameters on the resource URI, including the comp parameter if it exists.
4) Convert all parameter names to lowercase.
5) Sort the query parameters lexicographically by parameter name, in ascending order.
6) URL-decode each query parameter name and value.
7) Append each query parameter name and value to the string in the following format, making sure to include the colon (:) between the name and the value:
    parameter-name:parameter-value

8) If a query parameter has more than one value, sort all values lexicographically, then include them in a comma-separated list:
    parameter-name:parameter-value-1,parameter-value-2,parameter-value-n

9) Append a new line character (\n) after each name-value pair.

Rules:
  1) Avoid using the new line character (\n) in values for query parameters. If it must be used, ensure that it does not affect the format of the canonicalized resource string.
  2) Avoid using commas in query parameter values.
*/
func (a *Auth) canonicalizedResource(req *http.Request) string {
	var buffer bytes.Buffer

	buffer.WriteString(fmt.Sprintf("/%s%s", a.Account, req.URL.Path))
	queries := req.URL.Query()

	for key, values := range queries {
		sort.Strings(values)
		buffer.WriteString(fmt.Sprintf("\n%s:%s", key, strings.Join(values, ",")))
	}

	split := strings.Split(buffer.String(), "\n")
	sort.Strings(split)

	return strings.Join(split, "\n")
}
