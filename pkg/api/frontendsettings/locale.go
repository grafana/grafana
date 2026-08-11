package frontendsettings

import (
	"net/http"

	"golang.org/x/text/language"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

const DefaultLocale = "en-US"

// LocaleFromRequest returns the BCP 47 tag for regional formatting: dates, numbers and
// the first day of the week. Not the UI language, whose fixed set of translations has
// en-US as the only English and so cannot express a region.
func LocaleFromRequest(req *http.Request) string {
	if req == nil {
		return DefaultLocale
	}

	// Returns tags most-preferred first, honouring the quality values.
	tags, _, err := language.ParseAcceptLanguage(req.Header.Get("Accept-Language"))
	if err != nil || len(tags) == 0 {
		return DefaultLocale
	}

	// A wildcard header parses to "mul"; neither it nor "und" names a region.
	switch locale := tags[0].String(); locale {
	case "", "und", "mul":
		return DefaultLocale
	default:
		return locale
	}
}

// reqCtx's embedded *web.Context is nil in enough call sites that reading .Req directly
// is not safe.
func localeFromReqContext(reqCtx *contextmodel.ReqContext) string {
	if reqCtx == nil || reqCtx.Context == nil {
		return DefaultLocale
	}

	return LocaleFromRequest(reqCtx.Req)
}
