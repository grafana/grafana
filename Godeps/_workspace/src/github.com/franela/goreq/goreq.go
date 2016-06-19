package goreq

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"reflect"
	"strings"
	"time"
)

type itimeout interface {
	Timeout() bool
}
type Request struct {
	headers           []headerTuple
	cookies           []*http.Cookie
	Method            string
	Uri               string
	Body              interface{}
	QueryString       interface{}
	Timeout           time.Duration
	ContentType       string
	Accept            string
	Host              string
	UserAgent         string
	Insecure          bool
	MaxRedirects      int
	RedirectHeaders   bool
	Proxy             string
	Compression       *compression
	BasicAuthUsername string
	BasicAuthPassword string
	CookieJar         http.CookieJar
	ShowDebug         bool
	OnBeforeRequest   func(goreq *Request, httpreq *http.Request)
}

type compression struct {
	writer          func(buffer io.Writer) (io.WriteCloser, error)
	reader          func(buffer io.Reader) (io.ReadCloser, error)
	ContentEncoding string
}

type Response struct {
	*http.Response
	Uri  string
	Body *Body
	req  *http.Request
}

func (r Response) CancelRequest() {
	cancelRequest(DefaultTransport, r.req)

}

func cancelRequest(transport interface{}, r *http.Request) {
	if tp, ok := transport.(transportRequestCanceler); ok {
		tp.CancelRequest(r)
	}
}

type headerTuple struct {
	name  string
	value string
}

type Body struct {
	reader           io.ReadCloser
	compressedReader io.ReadCloser
}

type Error struct {
	timeout bool
	Err     error
}

type transportRequestCanceler interface {
	CancelRequest(*http.Request)
}

func (e *Error) Timeout() bool {
	return e.timeout
}

func (e *Error) Error() string {
	return e.Err.Error()
}

func (b *Body) Read(p []byte) (int, error) {
	if b.compressedReader != nil {
		return b.compressedReader.Read(p)
	}
	return b.reader.Read(p)
}

func (b *Body) Close() error {
	err := b.reader.Close()
	if b.compressedReader != nil {
		return b.compressedReader.Close()
	}
	return err
}

func (b *Body) FromJsonTo(o interface{}) error {
	return json.NewDecoder(b).Decode(o)
}

func (b *Body) ToString() (string, error) {
	body, err := ioutil.ReadAll(b)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func Gzip() *compression {
	reader := func(buffer io.Reader) (io.ReadCloser, error) {
		return gzip.NewReader(buffer)
	}
	writer := func(buffer io.Writer) (io.WriteCloser, error) {
		return gzip.NewWriter(buffer), nil
	}
	return &compression{writer: writer, reader: reader, ContentEncoding: "gzip"}
}

func Deflate() *compression {
	reader := func(buffer io.Reader) (io.ReadCloser, error) {
		return zlib.NewReader(buffer)
	}
	writer := func(buffer io.Writer) (io.WriteCloser, error) {
		return zlib.NewWriter(buffer), nil
	}
	return &compression{writer: writer, reader: reader, ContentEncoding: "deflate"}
}

func Zlib() *compression {
	return Deflate()
}

func paramParse(query interface{}) (string, error) {
	switch query.(type) {
	case url.Values:
		return query.(url.Values).Encode(), nil
	case *url.Values:
		return query.(*url.Values).Encode(), nil
	default:
		var v = &url.Values{}
		err := paramParseStruct(v, query)
		return v.Encode(), err
	}
}

func paramParseStruct(v *url.Values, query interface{}) error {
	var (
		s = reflect.ValueOf(query)
		t = reflect.TypeOf(query)
	)
	for t.Kind() == reflect.Ptr || t.Kind() == reflect.Interface {
		s = s.Elem()
		t = s.Type()
	}

	if t.Kind() != reflect.Struct {
		return errors.New("Can not parse QueryString.")
	}

	for i := 0; i < t.NumField(); i++ {
		var name string

		field := s.Field(i)
		typeField := t.Field(i)

		if !field.CanInterface() {
			continue
		}

		urlTag := typeField.Tag.Get("url")
		if urlTag == "-" {
			continue
		}

		name, opts := parseTag(urlTag)

		var omitEmpty, squash bool
		omitEmpty = opts.Contains("omitempty")
		squash = opts.Contains("squash")

		if squash {
			err := paramParseStruct(v, field.Interface())
			if err != nil {
				return err
			}
			continue
		}

		if urlTag == "" {
			name = strings.ToLower(typeField.Name)
		}

		if val := fmt.Sprintf("%v", field.Interface()); !(omitEmpty && len(val) == 0) {
			v.Add(name, val)
		}
	}
	return nil
}

func prepareRequestBody(b interface{}) (io.Reader, error) {
	switch b.(type) {
	case string:
		// treat is as text
		return strings.NewReader(b.(string)), nil
	case io.Reader:
		// treat is as text
		return b.(io.Reader), nil
	case []byte:
		//treat as byte array
		return bytes.NewReader(b.([]byte)), nil
	case nil:
		return nil, nil
	default:
		// try to jsonify it
		j, err := json.Marshal(b)
		if err == nil {
			return bytes.NewReader(j), nil
		}
		return nil, err
	}
}

var DefaultDialer = &net.Dialer{Timeout: 1000 * time.Millisecond}
var DefaultTransport http.RoundTripper = &http.Transport{Dial: DefaultDialer.Dial, Proxy: http.ProxyFromEnvironment}
var DefaultClient = &http.Client{Transport: DefaultTransport}

var proxyTransport http.RoundTripper
var proxyClient *http.Client

func SetConnectTimeout(duration time.Duration) {
	DefaultDialer.Timeout = duration
}

func (r *Request) AddHeader(name string, value string) {
	if r.headers == nil {
		r.headers = []headerTuple{}
	}
	r.headers = append(r.headers, headerTuple{name: name, value: value})
}

func (r Request) WithHeader(name string, value string) Request {
	r.AddHeader(name, value)
	return r
}

func (r *Request) AddCookie(c *http.Cookie) {
	r.cookies = append(r.cookies, c)
}

func (r Request) WithCookie(c *http.Cookie) Request {
	r.AddCookie(c)
	return r

}

func (r Request) Do() (*Response, error) {
	var client = DefaultClient
	var transport = DefaultTransport
	var resUri string
	var redirectFailed bool

	r.Method = valueOrDefault(r.Method, "GET")

	// use a client with a cookie jar if necessary. We create a new client not
	// to modify the default one.
	if r.CookieJar != nil {
		client = &http.Client{
			Transport: transport,
			Jar:       r.CookieJar,
		}
	}

	if r.Proxy != "" {
		proxyUrl, err := url.Parse(r.Proxy)
		if err != nil {
			// proxy address is in a wrong format
			return nil, &Error{Err: err}
		}

		//If jar is specified new client needs to be built
		if proxyTransport == nil || client.Jar != nil {
			proxyTransport = &http.Transport{Dial: DefaultDialer.Dial, Proxy: http.ProxyURL(proxyUrl)}
			proxyClient = &http.Client{Transport: proxyTransport, Jar: client.Jar}
		} else if proxyTransport, ok := proxyTransport.(*http.Transport); ok {
			proxyTransport.Proxy = http.ProxyURL(proxyUrl)
		}
		transport = proxyTransport
		client = proxyClient
	}

	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {

		if len(via) > r.MaxRedirects {
			redirectFailed = true
			return errors.New("Error redirecting. MaxRedirects reached")
		}

		resUri = req.URL.String()

		//By default Golang will not redirect request headers
		// https://code.google.com/p/go/issues/detail?id=4800&q=request%20header
		if r.RedirectHeaders {
			for key, val := range via[0].Header {
				req.Header[key] = val
			}
		}
		return nil
	}

	if transport, ok := transport.(*http.Transport); ok {
		if r.Insecure {
			if transport.TLSClientConfig != nil {
				transport.TLSClientConfig.InsecureSkipVerify = true
			} else {
				transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
			}
		} else if transport.TLSClientConfig != nil {
			// the default TLS client (when transport.TLSClientConfig==nil) is
			// already set to verify, so do nothing in that case
			transport.TLSClientConfig.InsecureSkipVerify = false
		}
	}

	req, err := r.NewRequest()

	if err != nil {
		// we couldn't parse the URL.
		return nil, &Error{Err: err}
	}

	timeout := false
	if r.Timeout > 0 {
		client.Timeout = r.Timeout
	}

	if r.ShowDebug {
		dump, err := httputil.DumpRequest(req, true)
		if err != nil {
			log.Println(err)
		}
		log.Println(string(dump))
	}

	if r.OnBeforeRequest != nil {
		r.OnBeforeRequest(&r, req)
	}
	res, err := client.Do(req)

	if err != nil {
		if !timeout {
			if t, ok := err.(itimeout); ok {
				timeout = t.Timeout()
			}
			if ue, ok := err.(*url.Error); ok {
				if t, ok := ue.Err.(itimeout); ok {
					timeout = t.Timeout()
				}
			}
		}

		var response *Response
		//If redirect fails we still want to return response data
		if redirectFailed {
			if res != nil {
				response = &Response{res, resUri, &Body{reader: res.Body}, req}
			} else {
				response = &Response{res, resUri, nil, req}
			}
		}

		//If redirect fails and we haven't set a redirect count we shouldn't return an error
		if redirectFailed && r.MaxRedirects == 0 {
			return response, nil
		}

		return response, &Error{timeout: timeout, Err: err}
	}

	if r.Compression != nil && strings.Contains(res.Header.Get("Content-Encoding"), r.Compression.ContentEncoding) {
		compressedReader, err := r.Compression.reader(res.Body)
		if err != nil {
			return nil, &Error{Err: err}
		}
		return &Response{res, resUri, &Body{reader: res.Body, compressedReader: compressedReader}, req}, nil
	}

	return &Response{res, resUri, &Body{reader: res.Body}, req}, nil
}

func (r Request) addHeaders(headersMap http.Header) {
	if len(r.UserAgent) > 0 {
		headersMap.Add("User-Agent", r.UserAgent)
	}
	if r.Accept != "" {
		headersMap.Add("Accept", r.Accept)
	}
	if r.ContentType != "" {
		headersMap.Add("Content-Type", r.ContentType)
	}
}

func (r Request) NewRequest() (*http.Request, error) {

	b, e := prepareRequestBody(r.Body)
	if e != nil {
		// there was a problem marshaling the body
		return nil, &Error{Err: e}
	}

	if r.QueryString != nil {
		param, e := paramParse(r.QueryString)
		if e != nil {
			return nil, &Error{Err: e}
		}
		r.Uri = r.Uri + "?" + param
	}

	var bodyReader io.Reader
	if b != nil && r.Compression != nil {
		buffer := bytes.NewBuffer([]byte{})
		readBuffer := bufio.NewReader(b)
		writer, err := r.Compression.writer(buffer)
		if err != nil {
			return nil, &Error{Err: err}
		}
		_, e = readBuffer.WriteTo(writer)
		writer.Close()
		if e != nil {
			return nil, &Error{Err: e}
		}
		bodyReader = buffer
	} else {
		bodyReader = b
	}

	req, err := http.NewRequest(r.Method, r.Uri, bodyReader)
	if err != nil {
		return nil, err
	}
	// add headers to the request
	req.Host = r.Host

	r.addHeaders(req.Header)
	if r.Compression != nil {
		req.Header.Add("Content-Encoding", r.Compression.ContentEncoding)
		req.Header.Add("Accept-Encoding", r.Compression.ContentEncoding)
	}
	if r.headers != nil {
		for _, header := range r.headers {
			req.Header.Add(header.name, header.value)
		}
	}

	//use basic auth if required
	if r.BasicAuthUsername != "" {
		req.SetBasicAuth(r.BasicAuthUsername, r.BasicAuthPassword)
	}

	for _, c := range r.cookies {
		req.AddCookie(c)
	}
	return req, nil
}

// Return value if nonempty, def otherwise.
func valueOrDefault(value, def string) string {
	if value != "" {
		return value
	}
	return def
}
