package palettes

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	palettesapi "github.com/grafana/grafana/apps/palettes/pkg/apis/palettes/v0alpha1"
	paletteutils "github.com/grafana/grafana/pkg/registry/apis/palettes/utils"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

var (
	paletteIDLabel    = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
	paletteColorValue = regexp.MustCompile(`^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)
)

const (
	maxPaletteIDLen      = 63
	maxDisplayNameLen    = 128
	maxGroupLen          = 64
	maxColors            = 64
	maxShareWithEntryLen = 256 // generous bound; real scopes are short
)

// AdmissionValidate implements admission checks for Palette create/update.
// Wire this from APIBuilder.Validate when the palettes API group is registered.
func AdmissionValidate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	if a.GetResource().Resource != Resource {
		return nil
	}

	op := a.GetOperation()
	if op != admission.Create && op != admission.Update {
		return nil
	}

	obj := a.GetObject()
	p, ok := obj.(*palettesapi.Palette)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected Palette object, got %T", obj))
	}

	return validatePalette(p)
}

func validatePalette(p *palettesapi.Palette) error {
	name := p.Name
	_, slug, ok := paletteutils.ParseOwnerWithSuffix(name)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("metadata.name: invalid palette name %q; expected org-<slug>, user-<uid>-<slug>, or team-<uid>-<slug>", name))
	}

	if p.Spec.Id != slug {
		return apierrors.NewBadRequest(fmt.Sprintf("spec.id must equal the name suffix (slug); name suffix is %q but spec.id is %q", slug, p.Spec.Id))
	}

	if len(p.Spec.Id) > maxPaletteIDLen {
		return apierrors.NewBadRequest(fmt.Sprintf("spec.id: length must be at most %d", maxPaletteIDLen))
	}
	if !paletteIDLabel.MatchString(p.Spec.Id) {
		return apierrors.NewBadRequest("spec.id: must match DNS label rules (lowercase letters, digits, hyphens; start and end with alphanumeric)")
	}

	display := strings.TrimSpace(p.Spec.DisplayName)
	if display == "" {
		return apierrors.NewBadRequest("spec.displayName: must be non-empty")
	}
	if len(display) > maxDisplayNameLen {
		return apierrors.NewBadRequest(fmt.Sprintf("spec.displayName: length must be at most %d (after trimming spaces)", maxDisplayNameLen))
	}

	if p.Spec.Group != nil && len(*p.Spec.Group) > maxGroupLen {
		return apierrors.NewBadRequest(fmt.Sprintf("spec.group: length must be at most %d", maxGroupLen))
	}

	colors := p.Spec.Colors
	if len(colors) == 0 {
		return apierrors.NewBadRequest("spec.colors: must contain at least one color")
	}
	if len(colors) > maxColors {
		return apierrors.NewBadRequest(fmt.Sprintf("spec.colors: at most %d entries allowed", maxColors))
	}
	for i, c := range colors {
		if !paletteColorValue.MatchString(c) {
			return apierrors.NewBadRequest(fmt.Sprintf("spec.colors[%d]: must be a strict hex color (#RGB, #RGBA, #RRGGBB, or #RRGGBBAA)", i))
		}
	}

	for i, sw := range p.Spec.ShareWith {
		s := string(sw)
		if len(s) > maxShareWithEntryLen {
			return apierrors.NewBadRequest(fmt.Sprintf("spec.shareWith[%d]: entry too long", i))
		}
		if s == "" {
			return apierrors.NewBadRequest(fmt.Sprintf("spec.shareWith[%d]: must not be empty", i))
		}
		if !isValidShareWithScope(s) {
			return apierrors.NewBadRequest(fmt.Sprintf("spec.shareWith[%d]: unrecognized scope %q; use \"org\", \"namespace\", \"user-<uid>\", or \"team-<uid>\"", i, s))
		}
	}

	return nil
}

func isValidShareWithScope(s string) bool {
	if s == "org" {
		return true
	}
	_, ok := prefutils.ParseOwnerFromName(s)
	return ok
}
