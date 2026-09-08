package v2

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	requestPathBytesMax         = 16 * 1024
	timezoneBytesMax            = 256
	concurrentRequestsMax       = 100_000
	requestDurationMax          = 24 * time.Hour
	responseBytesMax      int64 = 1 << 40
)

type RenderType string

const (
	RenderCSV RenderType = "csv"
	RenderPNG RenderType = "png"
	RenderPDF RenderType = "pdf"
)

type RequestInput struct {
	RenderType               RenderType
	Path                     string
	Timezone                 string
	Timeout                  time.Duration
	RequestTimeoutMultiplier time.Duration
	ConcurrentLimit          int
	Width                    int
	Height                   int
	DeviceScale              float64
	Headers                  http.Header
	OrgID                    int64
	UserID                   int64
	OrgRole                  string
}

type Request struct {
	renderType      RenderType
	callbackPath    callbackPath
	timezone        timezone
	timeout         requestTimeout
	concurrentLimit concurrentLimit
	width           imageWidth
	height          imageHeight
	deviceScale     deviceScale
	headers         http.Header
	identity        renderIdentity
}

type callbackPath struct {
	url *url.URL
}

type timezone struct {
	value string
}

type requestTimeout struct {
	renderer time.Duration
	request  time.Duration
}

type concurrentLimit struct {
	value int32
}

type imageWidth struct {
	value int
}

type imageHeight struct {
	pixels int
	full   bool
}

type deviceScale struct {
	value float64
}

type renderIdentity struct {
	orgID   int64
	userID  int64
	orgRole string
}

func ParseRequest(input RequestInput) (Request, error) {
	switch input.RenderType {
	case RenderCSV, RenderPNG, RenderPDF:
	default:
		return Request{}, fmt.Errorf("parse render type: unsupported value %q", input.RenderType)
	}

	if len(input.Path) == 0 || len(input.Path) > requestPathBytesMax {
		return Request{}, fmt.Errorf("parse callback path: length must be between 1 and %d bytes", requestPathBytesMax)
	}
	parsedPath, err := url.Parse(input.Path)
	if err != nil {
		return Request{}, fmt.Errorf("parse callback path: %w", err)
	}
	if parsedPath.IsAbs() || parsedPath.Host != "" || strings.HasPrefix(parsedPath.Path, "//") {
		return Request{}, errors.New("parse callback path: relative URL is required")
	}

	if len(input.Timezone) > timezoneBytesMax {
		return Request{}, fmt.Errorf("parse timezone: length must not exceed %d bytes", timezoneBytesMax)
	}
	if input.Timeout < time.Second || input.Timeout > requestDurationMax {
		return Request{}, fmt.Errorf("parse timeout: duration must be between %s and %s", time.Second, requestDurationMax)
	}
	multiplier := input.RequestTimeoutMultiplier
	if multiplier == 0 {
		multiplier = 2
	}
	if multiplier < 1 || input.Timeout > requestDurationMax/multiplier {
		return Request{}, fmt.Errorf("parse request timeout: duration must not exceed %s", requestDurationMax)
	}
	requestDuration := input.Timeout * multiplier

	if input.ConcurrentLimit < 0 || input.ConcurrentLimit > concurrentRequestsMax {
		return Request{}, fmt.Errorf("parse concurrent limit: value must be between 0 and %d", concurrentRequestsMax)
	}

	width := input.Width
	height := imageHeight{pixels: input.Height}
	if input.RenderType == RenderPNG {
		if width <= 0 || input.Height == 0 || input.Height < -1 {
			return Request{}, errors.New("parse image dimensions: positive width and positive or full height are required for PNG")
		}
		height.full = input.Height == -1
	}

	scale := input.DeviceScale
	if input.RenderType != RenderCSV && (math.IsInf(scale, 0) || math.IsNaN(scale) || scale <= 0) {
		scale = 1
	}

	return Request{
		renderType:      input.RenderType,
		callbackPath:    callbackPath{url: parsedPath},
		timezone:        timezone{value: input.Timezone},
		timeout:         requestTimeout{renderer: input.Timeout, request: requestDuration},
		concurrentLimit: concurrentLimit{value: int32(input.ConcurrentLimit)},
		width:           imageWidth{value: width},
		height:          height,
		deviceScale:     deviceScale{value: scale},
		headers:         input.Headers.Clone(),
		identity: renderIdentity{
			orgID:   input.OrgID,
			userID:  input.UserID,
			orgRole: input.OrgRole,
		},
	}, nil
}

func (h imageHeight) rendererValue() int {
	if h.full {
		return -1
	}
	return h.pixels
}

type LimitsInput struct {
	ResponseBytes int64
}

type Limits struct {
	responseBytes responseBytesLimit
}

type responseBytesLimit struct {
	bytes int64
}

func ParseLimits(input LimitsInput) (Limits, error) {
	if input.ResponseBytes <= 0 || input.ResponseBytes > responseBytesMax {
		return Limits{}, fmt.Errorf("parse response byte limit: value must be between 1 and %d", responseBytesMax)
	}
	return Limits{responseBytes: responseBytesLimit{bytes: input.ResponseBytes}}, nil
}
