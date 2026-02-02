package util

import (
	"errors"
	"fmt"
	"net/url"

	"github.com/gorhill/cronexpr"

	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/microcosm-cc/bluemonday"
)

var (
	Hourly                 = 1
	Daily                  = 2
	Weekly                 = 3
	Monthly                = 4
	UnimplementedFrequency = errors.New("unimplemented frequency")
)

var isUrlOrBase64ImageRegex = regexp.MustCompile(`^(https?):\/\/((([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,})|(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))(:\d+)?(\/[a-zA-Z0-9\-._~:\/?#\[\]@!$&'()*+,;=]*)?\.(?:png|jpe?g)$|^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/]+={0,2}$`)

func GetCronExpr(frequency int, time string, days []int, months []int) (string, error) {
	var hour string
	var minute string
	if frequency != Hourly {
		data := strings.Split(time, ":")
		hour = data[0]
		minute = data[1]
	} else {
		minute = time
	}

	var cronExpr string
	if frequency == Hourly {
		cronExpr = fmt.Sprintf("%v 0/1 * * *", minute)
	} else if frequency == Daily {
		cronExpr = fmt.Sprintf("%v %v * * *", minute, hour)
	} else if frequency == Weekly {
		cronExpr = fmt.Sprintf("%v %v * * %v", minute, hour, JoinItoa(days))
	} else if frequency == Monthly {
		cronExpr = fmt.Sprintf("%v %v %v %v *", minute, hour, JoinItoa(days), JoinItoa(months))
	} else {
		return "", UnimplementedFrequency
	}
	return cronExpr, nil
}
func GetNextAt(cronExpr string, timeZone string) (time.Time, error) {
	// utc in lowercase is not recognized by Go
	if strings.ToLower(timeZone) == "utc" {
		timeZone = "UTC"
	}

	// Load timezone
	loadZone, err := time.LoadLocation(timeZone)

	if err != nil {
		return time.Time{}, err
	}

	// Parse the cronExpr
	cronParsed, err := cronexpr.Parse(cronExpr)
	if err != nil {
		return time.Time{}, err
	}

	// Target current time is most likely the start time.
	targetTime := time.Now().UTC().In(loadZone)

	// Next job execution of the target from target time
	targetNextAt := cronParsed.Next(targetTime)

	// Target next job execution to UTC
	utcTime := targetNextAt.UTC()

	return utcTime, nil
}

func UnixToTime(unix int64) *time.Time {
	if unix != 0 {
		unixTime := time.Unix(unix, 0).UTC()
		return &unixTime
	}
	return nil
}

type SanitizeOptions struct {
	AllowStyle bool
}

func SanitizeHtml(value string, opts SanitizeOptions) string {
	p := bluemonday.UGCPolicy()
	p.AllowURLSchemes("mailto", "http", "https")
	p.SkipElementsContent("input", "textarea")
	p.RequireNoFollowOnLinks(true)

	// whitelist certain styles and elements
	if opts.AllowStyle {
		allowedSpacingElements := []string{"p", "h1", "h2", "h3", "h4", "pre", "blockquote", "li"}
		allowedStyleElements := []string{"span", "p", "s", "em", "strong", "u"}
		allowedListElements := []string{"ol", "ul"}

		rgbColorsRegex := `^rgb\((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?),\s*(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?),\s*(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\)$`
		numbersRegex := `\d{1,3}px`
		fontsRegex := GenerateFontsRegex("default", "helvetica", "arial", "georgia", "impact", "tahoma", "verdana", "\"times new roman\"",
			"charcoal", "palatino", "geneva", "times", "sans-serif", "serif")

		p.AllowTables()
		p.AllowElements("blockquote", "pre")

		// allow certain styles and spacing
		p.AllowAttrs("style").OnElements(allowedStyleElements...)
		p.AllowAttrs("style").OnElements(allowedListElements...)
		p.AllowStyles("color", "background-color").Matching(regexp.MustCompile(rgbColorsRegex)).OnElements(allowedStyleElements...)
		p.AllowStyles("font-size").Matching(regexp.MustCompile(numbersRegex)).OnElements(allowedStyleElements...)
		p.AllowStyles("font-family").Matching(regexp.MustCompile(fontsRegex)).OnElements(allowedStyleElements...)
		p.AllowStyles("margin-left").Matching(regexp.MustCompile(numbersRegex)).OnElements(allowedSpacingElements...)
		p.AllowStyles("text-align").MatchingEnum("left", "right", "center", "justify").OnElements(allowedSpacingElements...)
		p.AllowStyles("list-style-type").MatchingEnum("upper-roman", "circle", "square",
			"lower-alpha", "lower-greek", "lower-roman", "upper-alpha", "upper-roman").OnElements(allowedListElements...)

		// allow images and styling
		p.AllowDataURIImages()
		p.AllowAttrs("width", "height").OnElements("img")
		p.AllowStyles("border-radius").Matching(regexp.MustCompile(numbersRegex)).OnElements("img")
		p.AllowStyles("display").MatchingEnum("block").OnElements("img")
		p.AllowStyles("float").MatchingEnum("left", "right", "none", "inherit").OnElements("img")
		p.AllowStyles("width", "height").Matching(regexp.MustCompile(numbersRegex)).OnElements("img")
		marginRegex := `^auto$|^(\d+px)(?:\s+(\d+px))?(?:\s+(\d+px))?(?:\s+(\d+px))?$`
		p.AllowStyles("margin", "margin-left", "margin-right", "margin-top", "margin-bottom").Matching(regexp.MustCompile(marginRegex)).OnElements("img")
	}

	sanitizedValue := p.Sanitize(value)
	return sanitizedValue
}

func GenerateFontsRegex(allowedFontsArray ...string) string {
	allowedFonts := strings.Join(allowedFontsArray[:], "|")
	regex := `^(` + allowedFonts + `)(,\s+(` + allowedFonts + `))*$`
	return regex
}

func DomainValidator(value string) bool {
	RegExp := regexp.MustCompile(`^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|([a-zA-Z0-9][a-zA-Z0-9-_]{1,61}[a-zA-Z0-9]))\.([a-zA-Z]{2,6}|[a-zA-Z0-9-]{2,30}\.[a-zA-Z
 ]{2,3})$`)
	return RegExp.MatchString(value)
}

func EmailDomainValidator(emails, domains []string) []string {
	var validEmailIds []string
	for _, recipient := range emails {
		parts := strings.Split(recipient, "@")
		if len(parts) == 2 {
			domain := parts[1]
			if StringsContain(domains, domain) {
				validEmailIds = append(validEmailIds, recipient)
			}
		}
	}
	return validEmailIds
}

func ParamsInt64(value string) (int64, error) {
	return strconv.ParseInt(value, 10, 64)
}

func ParamsBool(value string) (bool, error) {
	return strconv.ParseBool(value)
}

func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func RemoveDuplicates(strList []string) []string {
	list := make([]string, 0)
	for _, item := range strList {
		if !Contains(list, item) {
			list = append(list, item)
		}
	}
	return list
}

func StringsContain(values []string, search string) bool {
	for _, v := range values {
		if search == v {
			return true
		}
	}

	return false
}

func ValidateUrlScheme(str string) bool {
	u, err := url.Parse(str)
	if err != nil {
		return false
	}
	validScheme := u.Scheme == "http" || u.Scheme == "https" || u.Scheme == ""
	validHost := u.Host != ""
	return validScheme && validHost
}

func IsValidImageURL(url string) bool {
	allowedExtensions := []string{".png", ".jpg", ".jpeg"}
	for _, ext := range allowedExtensions {
		if strings.HasSuffix(strings.ToLower(url), ext) {
			return true
		}
	}
	return false
}

func IsValidURLOrBase64Image(url string) bool {
	return isUrlOrBase64ImageRegex.MatchString(url)
}

func ValidateDateFormat(format string) string {
    switch format {
    case "MM-DD-YYYY", "DD-MM-YYYY", "YYYY-MM-DD", 
         "MMM-DD-YYYY", "DD-MMM-YYYY", "YYYY-MMM-DD":
        return format
    default:
        return "MM-DD-YYYY"
    }
}
