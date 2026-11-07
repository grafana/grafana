package collections

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
)

var simpleInterval = regexp.MustCompile(`^[0-9]+(ms|s|m|h|d|w|M|y)$`)

const (
	// A floor keeps a typo such as "1s" from turning a wall display into a tight reload loop.
	minSlideshowInterval = 10 * time.Second
	// Browsers treat a timer longer than about 24.8 days as one millisecond, so a long interval
	// would rotate on every tick instead of waiting.
	maxSlideshowInterval = 24 * time.Hour
	maxSlideshowItems    = 500
	maxSlideshowTitle    = 255
	// An invalid value is echoed back in the error. A long one would make the response as large as
	// the request, so only its start is shown.
	maxEchoedValue = 64
	// Reporting every problem of a huge or fully invalid slideshow would cost as much as the request
	// is large and echo it back, so collection stops after this many field errors.
	maxSlideshowErrors = 50
)

// Validate implements builder.APIGroupValidation.
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	switch a.GetOperation() {
	case admission.Create, admission.Update:
	default:
		return nil
	}

	if a.GetResource().Resource != collections.SlideshowResourceInfo.GroupResource().Resource {
		return nil
	}
	slideshow, ok := a.GetObject().(*collections.Slideshow)
	if !ok {
		return fmt.Errorf("expected slideshow object: (%T)", a.GetObject())
	}

	// Whether an item still exists, or has a resolver, depends on who is looking, so it is
	// checked when the slideshow plays and not here.
	if errs := validateSlideshowSpec(&slideshow.Spec); len(errs) > 0 {
		return apierrors.NewInvalid(collections.SlideshowResourceInfo.GroupVersionKind().GroupKind(), slideshow.Name, errs)
	}
	return nil
}

func validateSlideshowSpec(spec *collections.SlideshowSpec) field.ErrorList {
	var errs field.ErrorList
	root := field.NewPath("spec")

	if strings.TrimSpace(spec.Title) == "" {
		errs = append(errs, field.Required(root.Child("title"), "title is required"))
	}
	if utf8.RuneCountInString(spec.Title) > maxSlideshowTitle {
		errs = append(errs, field.TooLongCharacters(root.Child("title"), spec.Title, maxSlideshowTitle))
	}
	if err := validateSlideshowInterval(root.Child("interval"), spec.Interval); err != nil {
		errs = append(errs, err)
	}

	items := root.Child("items")
	// Over the cap nothing else about the items is worth reporting, and checking them would make
	// the cost of a rejected request grow with its size.
	if len(spec.Items) > maxSlideshowItems {
		return append(errs, field.TooMany(items, len(spec.Items), maxSlideshowItems))
	}
	for i, item := range spec.Items {
		if len(errs) >= maxSlideshowErrors {
			break
		}
		p := items.Index(i)
		if item.Group == "" {
			errs = append(errs, field.Required(p.Child("group"), "group is required"))
		}
		if item.Resource == "" {
			errs = append(errs, field.Required(p.Child("resource"), "resource is required"))
		}
		if item.Name == "" {
			errs = append(errs, field.Required(p.Child("name"), "name is required"))
		}
		if item.Interval != nil {
			if err := validateSlideshowInterval(p.Child("interval"), *item.Interval); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errs
}

func validateSlideshowInterval(path *field.Path, value string) *field.Error {
	if value == "" {
		return field.Required(path, "interval is required")
	}
	// One whole number and one unit: that is all the player reads, so a longer form such as
	// 1h30m would be accepted here and then play for a different time.
	d, err := gtime.ParseDuration(value)
	if err != nil || !simpleInterval.MatchString(value) {
		return field.Invalid(path, truncateForError(value), "must be a whole number and a unit, such as 30s or 5m")
	}
	if d < minSlideshowInterval {
		return field.Invalid(path, value, "must be at least "+minSlideshowInterval.String())
	}
	if d > maxSlideshowInterval {
		return field.Invalid(path, value, "must be at most 24h")
	}
	return nil
}

func truncateForError(value string) string {
	if utf8.RuneCountInString(value) <= maxEchoedValue {
		return value
	}
	return string([]rune(value)[:maxEchoedValue]) + "..."
}
