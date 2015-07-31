package gou

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
)

// Simple Fetch Wrapper, given a url it returns bytes
func Fetch(url string) (ret []byte, err error) {
	resp, err := http.Get(url)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, err.Error())
		return
	}
	ret, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}
	return
}

// Simple Fetch Wrapper, given a url it returns bytes and response
func FetchResp(url string) (ret []byte, err error, resp *http.Response) {
	resp, err = http.Get(url)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, err.Error())
	}
	if resp == nil || resp.Body == nil {
		return
	}
	ret, err = ioutil.ReadAll(resp.Body)
	return
}

// Simple Fetch Wrapper, given a url it returns Helper, error
// Sends as type application/json, interprets whatever datatype is sent in appropriately
func JsonHelperHttp(method, urlStr string, data interface{}) (JsonHelper, error) {
	var body io.Reader
	if data != nil {
		switch val := data.(type) {
		case string:
			body = bytes.NewReader([]byte(val))
		case io.Reader:
			body = val
		case url.Values:
			body = bytes.NewReader([]byte(val.Encode()))
		default:
			by, err := json.Marshal(data)
			if err != nil {
				return nil, err
			}
			body = bytes.NewReader(by)
		}

	}
	req, err := http.NewRequest(method, urlStr, body)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	jh, err := NewJsonHelperReader(resp.Body)
	return jh, err
}

// posts an application/json to url with body
// ie:   type = application/json
func PostJson(url, body string) (ret string, err error, resp *http.Response) {
	//Post(url string, bodyType string, body io.Reader)
	buf := bytes.NewBufferString(body)
	resp, err = http.Post(url, "application/json", buf)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, err.Error())
		return "", err, resp
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err, resp
	}

	return string(data), nil, resp
}

// issues http delete an application/json to url with body
func DeleteJson(url, body string) (ret string, err error, resp *http.Response) {
	//Post(url string, bodyType string, body io.Reader)
	buf := bytes.NewBufferString(body)
	Debug(buf.Len())
	req, err := http.NewRequest("DELETE", url, buf)
	if err != nil {
		Debug(err)
		return
	}

	req.Header.Add("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req) //(url, "application/json", buf)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, err.Error())
		return "", err, resp
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err, resp
	}

	return string(data), nil, resp
}

// posts a www-form encoded form to url with body
func PostForm(url, body string) (ret string, err error, resp *http.Response) {
	//Post(url string, bodyType string, body io.Reader)
	buf := bytes.NewBufferString(body)
	resp, err = http.Post(url, "application/x-www-form-urlencoded", buf)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, url, "  ", body, "    ", err.Error())
		return "", err, resp
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err, resp
	}

	return string(data), nil, resp
}

// issues http put an application/json to url with optional body
func PutJson(url, body string) (ret string, err error, resp *http.Response) {
	buf := bytes.NewBufferString(body)
	req, err := http.NewRequest("PUT", url, buf)
	if err != nil {
		Debug(err)
		return
	}
	req.Header.Add("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	defer func() {
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}()
	if err != nil {
		Log(WARN, err.Error())
		return "", err, resp
	}
	data, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err, resp
	}

	return string(data), nil, resp
}
