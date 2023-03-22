package caching

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	cacheStatusKey = "X-CACHE-STATUS"
	cacheHeader    = "X-Cache"
	cacheSkipValue = "BYPASS"
	cacheNoneValue = "NONE"
)

var statusToValue map[CacheStatus]string = map[CacheStatus]string{
	StatusNotFound:   "MISS",
	StatusCacheHit:   "HIT",
	StatusCacheError: "ERROR",
	StatusDisabled:   "DISABLED",
}

func MarkCacheStatus(isSkip bool, resp CachedQueryDataResponse) {
	if isSkip {
		populateCacheMeta(resp.Response, cacheSkipValue)
	} else {
		populateCacheMeta(resp.Response, statusToValue[resp.Status])
	}
}

func GetCacheHeaders(r *backend.QueryDataResponse) map[string]string {
	h := map[string]string{cacheHeader: cacheNoneValue}
	if r == nil || r.Responses == nil {
		return h
	}
	for _, v := range r.Responses {
		if len(v.Frames) > 0 {
			f := v.Frames[0]
			if f.Meta == nil || f.Meta.Custom == nil {
				continue
			}
			if m, ok := f.Meta.Custom.(map[string]any); ok {
				if v, ok := m[cacheStatusKey]; ok {
					h[cacheHeader] = v.(string)
					break
				}
			}
		}
	}
	return h
}

func populateCacheMeta(r *backend.QueryDataResponse, value string) {
	if r == nil || r.Responses == nil {
		return
	}
	if value == "" {
		value = cacheNoneValue
	}
	for k, v := range r.Responses {
		if len(v.Frames) > 0 {
			f := v.Frames[0]
			if f.Meta == nil {
				f.Meta = &data.FrameMeta{}
			}
			if f.Meta.Custom == nil {
				f.Meta.Custom = map[string]any{}
			}
			if m, ok := f.Meta.Custom.(map[string]any); ok {
				m[cacheStatusKey] = value
				r.Responses[k] = v
			}
		}
	}
}
