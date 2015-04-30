email
=====

[![Build Status](https://travis-ci.org/jordan-wright/email.png?branch=master)](https://travis-ci.org/jordan-wright/email)

Robust and flexible email library for Go

### Email for humans
The ```email``` package is designed to be simple to use, but flexible enough so as not to be restrictive. The goal is to provide an *email interface for humans*.

The ```email``` package currently supports the following:
*  From, To, Bcc, and Cc fields
*  Email addresses in both "test@example.com" and "First Last &lt;test@example.com&gt;" format
*  Text and HTML Message Body
*  Attachments
*  Read Receipts
*  Custom headers
*  More to come!

### Installation
```go get github.com/jordan-wright/email```

*Note: Requires go version 1.1 and above*

### Examples
#### Sending email using Gmail
```
e := email.NewEmail()
e.From = "Jordan Wright <test@gmail.com>"
e.To = []string{"test@example.com"}
e.Bcc = []string{"test_bcc@example.com"}
e.Cc = []string{"test_cc@example.com"}
e.Subject = "Awesome Subject"
e.Text = []byte("Text Body is, of course, supported!")
e.HTML = []byte("<h1>Fancy HTML is supported, too!</h1>")
e.Send("smtp.gmail.com:587", smtp.PlainAuth("", "test@gmail.com", "password123", "smtp.gmail.com"))
```

#### Another Method for Creating an Email
You can also create an email directly by creating a struct as follows:
```
e := &email.Email {
	To: []string{"test@example.com"},
	From: "Jordan Wright <test@gmail.com>",
	Subject: "Awesome Subject",
	Text: []byte("Text Body is, of course, supported!"),
	HTML: []byte("<h1>Fancy HTML is supported, too!</h1>"),
	Headers: textproto.MIMEHeader{},
}
```

#### Attaching a File
```
e := NewEmail()
e.AttachFile("test.txt")
```

### Documentation
[http://godoc.org/github.com/jordan-wright/email](http://godoc.org/github.com/jordan-wright/email)

### Other Sources
Sections inspired by the handy [gophermail](https://github.com/jpoehls/gophermail) project.

### Contributors
I'd like to thank all the [contributors and maintainers](https://github.com/jordan-wright/email/graphs/contributors) of this package.

A special thanks goes out to Jed Denlea [jeddenlea](https://github.com/jeddenlea) for his numerous contributions and optimizations.