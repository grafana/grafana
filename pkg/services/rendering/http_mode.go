package rendering

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

var netTransport = &http.Transport{
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout:   30 * time.Second,
		DualStack: true,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}

func (rs *RenderingService) renderViaHttp(ctx context.Context, opts Opts) (*RenderResult, error) {
	filePath := rs.getFilePathForNewImage()

	var netClient = &http.Client{
		Timeout:   opts.Timeout,
		Transport: netTransport,
	}

	rendererUrl, err := url.Parse(rs.Cfg.RendererUrl)
	if err != nil {
		return nil, err
	}

	queryParams := rendererUrl.Query()
	queryParams.Add("url", rs.getURL(opts.Path))
	queryParams.Add("renderKey", rs.getRenderKey(opts.UserId, opts.OrgId, opts.OrgRole))
	queryParams.Add("width", strconv.Itoa(opts.Width))
	queryParams.Add("height", strconv.Itoa(opts.Height))
	queryParams.Add("domain", rs.getLocalDomain())
	queryParams.Add("timezone", isoTimeOffsetToPosixTz(opts.Timezone))
	queryParams.Add("encoding", opts.Encoding)
	queryParams.Add("timeout", strconv.Itoa(int(opts.Timeout.Seconds())))
	rendererUrl.RawQuery = queryParams.Encode()

	req, err := http.NewRequest("GET", rendererUrl.String(), nil)
	if err != nil {
		return nil, err
	}

	// make request to renderer server
	resp, err := netClient.Do(req)
	if err != nil {
		return nil, err
	}

	// save response to file
	defer resp.Body.Close()
	out, err := os.Create(filePath)
	if err != nil {
		return nil, err
	}
	defer out.Close()
	io.Copy(out, resp.Body)

	return &RenderResult{FilePath: filePath}, err
}
