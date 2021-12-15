package thumbs

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

type renderHttp struct {
	crawlerURL string
	config     crawConfig
}

func newRenderHttp(crawlerURL string, cfg crawConfig) dashRenderer {
	return &renderHttp{
		crawlerURL: crawlerURL,
		config:     cfg,
	}
}

func (r *renderHttp) GetPreview(req *previewRequest) *previewResponse {
	p := getFilePath(r.config.ScreenshotsFolder, req)
	if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
		return r.queueRender(p, req)
	}

	return &previewResponse{
		Path: p,
		Code: 200,
	}
}

func (r *renderHttp) CrawlerCmd(cfg *crawlCmd) (json.RawMessage, error) {
	cmd := r.config
	cmd.crawlCmd = *cfg

	jsonData, err := json.Marshal(cmd)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequest("POST", r.crawlerURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json; charset=UTF-8")

	client := &http.Client{}
	response, error := client.Do(request)
	if error != nil {
		return nil, err
	}
	defer func() {
		_ = response.Body.Close()
	}()

	return ioutil.ReadAll(response.Body)
}

func (r *renderHttp) queueRender(p string, req *previewRequest) *previewResponse {
	go func() {
		fmt.Printf("todo? queue")
	}()

	return &previewResponse{
		Code: 202,
		Path: p,
	}
}
