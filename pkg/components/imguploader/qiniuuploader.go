package imguploader

import (
	"fmt"

	"net/http"

	"encoding/json"
	"io/ioutil"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/qiniu/api.v7/auth/qbox"
	"github.com/qiniu/api.v7/conf"
	"github.com/qiniu/api.v7/kodo"
	"github.com/qiniu/api.v7/kodocli"
)

type QiniuUploader struct {
	bucket       string
	secretKey    string
	accessKey    string
	domain       string
	uploader     kodocli.Uploader
	getUrlClient *http.Client
	log          log.Logger
}

func NewQiniuUploader(bucket, accessKey, secretKey string) *QiniuUploader {
	uploader := kodocli.NewUploaderWithoutZone(nil)
	mac := qbox.NewMac(accessKey, secretKey)
	client := qbox.NewClient(mac, http.DefaultTransport)
	conf.ACCESS_KEY = accessKey
	conf.SECRET_KEY = secretKey
	return &QiniuUploader{
		bucket:       bucket,
		accessKey:    accessKey,
		secretKey:    secretKey,
		uploader:     uploader,
		getUrlClient: client,
		log:          log.New("qiniuuploader"),
	}
}

func (u *QiniuUploader) Upload(imageDiskPath string) (string, error) {
	c := kodo.New(0, nil)
	policy := &kodo.PutPolicy{
		Scope:   u.bucket,
		Expires: 3600,
	}
	token := c.MakeUptoken(policy)
	var ret kodocli.PutRet
	fmt.Println("token: ", token)

	key := util.GetRandomString(20) + ".png"

	err := u.uploader.PutFile(nil, &ret, token, key, imageDiskPath, nil)
	if err != nil {
		return "", fmt.Errorf("Upload to Qiniu failed: %v", err)
	}
	if u.domain != "" {
	} else {
		resp, err := u.getUrlClient.Get(fmt.Sprintf("http://api.qiniu.com/v6/domain/list?tbl=%v", u.bucket))
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		content, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return "", err
		}
		var domains []string
		err = json.Unmarshal(content, &domains)
		if err != nil {
			return "", err
		}
		if len(domains) < 1 {
			return "", fmt.Errorf("no domains avaliable in bucket %v", u.bucket)
		}
		u.domain = domains[0]
	}
	return fmt.Sprintf("http://%v/%v", u.domain, key), nil
}
