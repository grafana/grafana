package imguploader

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana/pkg/util"
)

type WebdavUploader struct {
	url      string
	username string
	password string
}

func (u *WebdavUploader) Upload(pa string) (string, error) {
	url, _ := url.Parse(u.url)
	url.Path = path.Join(url.Path, util.GetRandomString(20)+".png")

	imgData, err := ioutil.ReadFile(pa)
	req, err := http.NewRequest("PUT", url.String(), bytes.NewReader(imgData))

	if u.username != "" {
		req.SetBasicAuth(u.username, u.password)
	}

	res, err := http.DefaultClient.Do(req)

	if err != nil {
		return "", err
	}

	if res.StatusCode != http.StatusCreated {
		body, _ := ioutil.ReadAll(res.Body)
		return "", fmt.Errorf("Failed to upload image. Returned statuscode %v body %s", res.StatusCode, body)
	}

	return url.String(), nil
}

func NewWebdavImageUploader(url, username, passwrod string) (*WebdavUploader, error) {
	return &WebdavUploader{
		url:      url,
		username: username,
		password: passwrod,
	}, nil
}
