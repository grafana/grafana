package caching

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	cacheStatusKey = "X-CACHE-STATUS"
	cacheMissValue = "MISS"
	cacheHitValue  = "HIT"
	cacheSkipValue = "BYPASS"
)

func MarkCacheHit(r *backend.QueryDataResponse) {
	populateCacheMeta(r, cacheHitValue)
}

func MarkCacheMiss(r *backend.QueryDataResponse) {
	populateCacheMeta(r, cacheMissValue)
}

func MarkCacheBypass(r *backend.QueryDataResponse) {
	populateCacheMeta(r, cacheSkipValue)
}

func GetCacheHeaders(r *backend.QueryDataResponse) map[string]string {
	h := map[string]string{}
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
					h["X-Cache"] = v.(string)
					break
				}
			}
		}
	}

	if len(h) == 0 {
		h["X-Cache"] = "NONE"
	}

	return h
}

func populateCacheMeta(r *backend.QueryDataResponse, value string) {
	if r == nil || r.Responses == nil {
		return
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
