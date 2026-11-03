package collections

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	collections "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
)

const (
	// A floor keeps a typo such as "1s" from turning a wall display into a tight reload loop.
	minSlideshowInterval = 10 * time.Second
	maxSlideshowItems    = 500
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
	if err := validateSlideshowInterval(root.Child("interval"), spec.Interval); err != nil {
		errs = append(errs, err)
	}

	items := root.Child("items")
	if len(spec.Items) > maxSlideshowItems {
		errs = append(errs, field.TooMany(items, len(spec.Items), maxSlideshowItems))
	}
	for i, item := range spec.Items {
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
	d, err := gtime.ParseDuration(value)
	if err != nil {
		return field.Invalid(path, value, "must be a duration such as 30s or 5m")
	}
	if d < minSlideshowInterval {
		return field.Invalid(path, value, "must be at least "+minSlideshowInterval.String())
	}
	return nil
}
