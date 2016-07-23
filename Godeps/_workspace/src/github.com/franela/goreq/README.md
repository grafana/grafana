[![Build Status](https://img.shields.io/travis/franela/goreq/master.svg)](https://travis-ci.org/franela/goreq)
[![GoDoc](https://godoc.org/github.com/franela/goreq?status.svg)](https://godoc.org/github.com/franela/goreq)

GoReq
=======

Simple and sane HTTP request library for Go language.



**Table of Contents**

- [Why GoReq?](#user-content-why-goreq)
- [How do I install it?](#user-content-how-do-i-install-it)
- [What can I do with it?](#user-content-what-can-i-do-with-it)
  - [Making requests with different methods](#user-content-making-requests-with-different-methods)
  - [GET](#user-content-get)
    - [Tags](#user-content-tags)
  - [POST](#user-content-post)
    - [Sending payloads in the Body](#user-content-sending-payloads-in-the-body)
  - [Specifiying request headers](#user-content-specifiying-request-headers)
  - [Sending Cookies](#cookie-support)
  - [Setting timeouts](#user-content-setting-timeouts)
 - [Using the Response and Error](#user-content-using-the-response-and-error)
 - [Receiving JSON](#user-content-receiving-json)
 - [Sending/Receiving Compressed Payloads](#user-content-sendingreceiving-compressed-payloads)
    - [Using gzip compression:](#user-content-using-gzip-compression)
    - [Using deflate compression:](#user-content-using-deflate-compression)
    - [Using compressed responses:](#user-content-using-compressed-responses)
 - [Proxy](#proxy)
 - [Debugging requests](#debug)
     - [Getting raw Request & Response](#getting-raw-request--response)
 - [TODO:](#user-content-todo)



Why GoReq?
==========

Go has very nice native libraries that allows you to do lots of cool things. But sometimes those libraries are too low level, which means that to do a simple thing, like an HTTP Request, it takes some time. And if you want to do something as simple as adding a timeout to a request, you will end up writing several lines of code.

This is why we think GoReq is useful. Because you can do all your HTTP requests in a very simple and comprehensive way, while enabling you to do more advanced stuff by giving you access to the native API.

How do I install it?
====================

```bash
go get github.com/franela/goreq
```

What can I do with it?
======================

## Making requests with different methods

#### GET
```go
res, err := goreq.Request{ Uri: "http://www.google.com" }.Do()
```

GoReq default method is GET.

You can also set value to GET method easily

```go
type Item struct {
        Limit int
        Skip int
        Fields string
}

item := Item {
        Limit: 3,
        Skip: 5,
        Fields: "Value",
}

res, err := goreq.Request{
        Uri: "http://localhost:3000/",
        QueryString: item,
}.Do()
```
The sample above will send `http://localhost:3000/?limit=3&skip=5&fields=Value`

Alternatively the `url` tag can be used in struct fields to customize encoding properties

```go
type Item struct {
        TheLimit int `url:"the_limit"`
        TheSkip string `url:"the_skip,omitempty"`
        TheFields string `url:"-"`
}

item := Item {
        TheLimit: 3,
        TheSkip: "",
        TheFields: "Value",
}

res, err := goreq.Request{
        Uri: "http://localhost:3000/",
        QueryString: item,
}.Do()
```
The sample above will send `http://localhost:3000/?the_limit=3`


QueryString also support url.Values

```go
item := url.Values{}
item.Set("Limit", 3)
item.Add("Field", "somefield")
item.Add("Field", "someotherfield")

res, err := goreq.Request{
        Uri: "http://localhost:3000/",
        QueryString: item,
}.Do()
```

The sample above will send `http://localhost:3000/?limit=3&field=somefield&field=someotherfield`

### Tags

Struct field `url` tag is mainly used as the request parameter name.
Tags can be comma separated multiple values, 1st value is for naming and rest has special meanings.

- special tag for 1st value
    - `-`: value is ignored if set this

- special tag for rest 2nd value
    - `omitempty`: zero-value is ignored if set this
    - `squash`: the fields of embedded struct is used for parameter

#### Tag Examples

```go
type Place struct {
    Country string `url:"country"`
    City    string `url:"city"`
    ZipCode string `url:"zipcode,omitempty"`
}

type Person struct {
    Place `url:",squash"`

    FirstName string `url:"first_name"`
    LastName  string `url:"last_name"`
    Age       string `url:"age,omitempty"`
    Password  string `url:"-"`
}

johnbull := Person{
	Place: Place{ // squash the embedded struct value
		Country: "UK",
		City:    "London",
		ZipCode: "SW1",
	},
	FirstName: "John",
	LastName:  "Doe",
	Age:       "35",
	Password:  "my-secret", // ignored for parameter
}

goreq.Request{
	Uri:         "http://localhost/",
	QueryString: johnbull,
}.Do()
// =>  `http://localhost/?first_name=John&last_name=Doe&age=35&country=UK&city=London&zip_code=SW1`


// age and zipcode will be ignored because of `omitempty`
// but firstname isn't.
samurai := Person{
	Place: Place{ // squash the embedded struct value
		Country: "Japan",
		City:    "Tokyo",
	},
	LastName: "Yagyu",
}

goreq.Request{
	Uri:         "http://localhost/",
	QueryString: samurai,
}.Do()
// =>  `http://localhost/?first_name=&last_name=yagyu&country=Japan&city=Tokyo`
```


#### POST

```go
res, err := goreq.Request{ Method: "POST", Uri: "http://www.google.com" }.Do()
```

## Sending payloads in the Body

You can send ```string```, ```Reader``` or ```interface{}``` in the body. The first two will be sent as text. The last one will be marshalled to JSON, if possible.

```go
type Item struct {
    Id int
    Name string
}

item := Item{ Id: 1111, Name: "foobar" }

res, err := goreq.Request{
    Method: "POST",
    Uri: "http://www.google.com",
    Body: item,
}.Do()
```

## Specifiying request headers

We think that most of the times the request headers that you use are: ```Host```, ```Content-Type```, ```Accept``` and ```User-Agent```. This is why we decided to make it very easy to set these headers.

```go
res, err := goreq.Request{
    Uri: "http://www.google.com",
    Host: "foobar.com",
    Accept: "application/json",
    ContentType: "application/json",
    UserAgent: "goreq",
}.Do()
```

But sometimes you need to set other headers. You can still do it.

```go
req := goreq.Request{ Uri: "http://www.google.com" }

req.AddHeader("X-Custom", "somevalue")

req.Do()
```

Alternatively you can use the `WithHeader` function to keep the syntax short

```go
res, err = goreq.Request{ Uri: "http://www.google.com" }.WithHeader("X-Custom", "somevalue").Do()
```

## Cookie support

Cookies can be either set at the request level by sending a [CookieJar](http://golang.org/pkg/net/http/cookiejar/) in the `CookieJar` request field
or you can use goreq's one-liner WithCookie method as shown below

```go
res, err := goreq.Request{
    Uri: "http://www.google.com",
}.
WithCookie(&http.Cookie{Name: "c1", Value: "v1"}).
Do()
```

## Setting timeouts

GoReq supports 2 kind of timeouts. A general connection timeout and a request specific one. By default the connection timeout is of 1 second. There is no default for request timeout, which means it will wait forever.

You can change the connection timeout doing:

```go
goreq.SetConnectTimeout(100 * time.Millisecond)
```

And specify the request timeout doing:

```go
res, err := goreq.Request{
    Uri: "http://www.google.com",
    Timeout: 500 * time.Millisecond,
}.Do()
```

## Using the Response and Error

GoReq will always return 2 values: a ```Response``` and an ```Error```.
If ```Error``` is not ```nil``` it means that an error happened while doing the request and you shouldn't use the ```Response``` in any way.
You can check what happened by getting the error message:

```go
fmt.Println(err.Error())
```
And to make it easy to know if it was a timeout error, you can ask the error or return it:

```go
if serr, ok := err.(*goreq.Error); ok {
    if serr.Timeout() {
        ...
    }
}
return err
```

If you don't get an error, you can safely use the ```Response```.

```go
res.Uri // return final URL location of the response (fulfilled after redirect was made)
res.StatusCode // return the status code of the response
res.Body // gives you access to the body
res.Body.ToString() // will return the body as a string
res.Header.Get("Content-Type") // gives you access to all the response headers
```
Remember that you should **always** close `res.Body` if it's not `nil`

## Receiving JSON

GoReq will help you to receive and unmarshal JSON.

```go
type Item struct {
    Id int
    Name string
}

var item Item

res.Body.FromJsonTo(&item)
```

## Sending/Receiving Compressed Payloads
GoReq supports gzip, deflate and zlib compression of requests' body and transparent decompression of responses provided they have a correct `Content-Encoding` header.

#####Using gzip compression:
```go
res, err := goreq.Request{
    Method: "POST",
    Uri: "http://www.google.com",
    Body: item,
    Compression: goreq.Gzip(),
}.Do()
```
#####Using deflate/zlib compression:
```go
res, err := goreq.Request{
    Method: "POST",
    Uri: "http://www.google.com",
    Body: item,
    Compression: goreq.Deflate(),
}.Do()
```
#####Using compressed responses:
If servers replies a correct and matching `Content-Encoding` header (gzip requires `Content-Encoding: gzip` and deflate `Content-Encoding: deflate`) goreq transparently decompresses the response so the previous example should always work:
```go
type Item struct {
    Id int
    Name string
}
res, err := goreq.Request{
    Method: "POST",
    Uri: "http://www.google.com",
    Body: item,
    Compression: goreq.Gzip(),
}.Do()
var item Item
res.Body.FromJsonTo(&item)
```
If no `Content-Encoding` header is replied by the server GoReq will return the crude response.

## Proxy
If you need to use a proxy for your requests GoReq supports the standard `http_proxy` env variable as well as manually setting the proxy for each request

```go
res, err := goreq.Request{
    Method: "GET",
    Proxy: "http://myproxy:myproxyport",
    Uri: "http://www.google.com",
}.Do()
```

### Proxy basic auth is also supported

```go
res, err := goreq.Request{
    Method: "GET",
    Proxy: "http://user:pass@myproxy:myproxyport",
    Uri: "http://www.google.com",
}.Do()
```

## Debug
If you need to debug your http requests, it can print the http request detail.

```go
res, err := goreq.Request{
	Method:      "GET",
	Uri:         "http://www.google.com",
	Compression: goreq.Gzip(),
	ShowDebug:   true,
}.Do()
fmt.Println(res, err)
```

and it will print the log:
```
GET / HTTP/1.1
Host: www.google.com
Accept:
Accept-Encoding: gzip
Content-Encoding: gzip
Content-Type:
```


### Getting raw Request & Response 

To get the Request:

```go
req := goreq.Request{
        Host: "foobar.com",
}

//req.Request will return a new instance of an http.Request so you can safely use it for something else
request, _ := req.NewRequest()

```


To get the Response:

```go
res, err := goreq.Request{
	Method:      "GET",
	Uri:         "http://www.google.com",
	Compression: goreq.Gzip(),
	ShowDebug:   true,
}.Do()

// res.Response will contain the original http.Response structure 
fmt.Println(res.Response, err)
```




TODO:
-----

We do have a couple of [issues](https://github.com/franela/goreq/issues) pending we'll be addressing soon. But feel free to
contribute and send us PRs (with tests please :smile:).
