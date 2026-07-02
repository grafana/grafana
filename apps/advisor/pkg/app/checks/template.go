package checks

import (
	"fmt"
	"regexp"
	"strings"
)

// Steps whose Description or Resolution contain parameterised values or links
// implement one or more of the small capability interfaces below, exposing
// those parts separately from the surrounding text. Each interface is
// independent so a step only implements what it actually has; a step with
// only a link in its Resolution needs just ResolutionLinker.
//
// The Description() and Resolution() methods on such a step return a TEMPLATE
// with two kinds of placeholder:
//
//   - "{{name}}" for values, resolved from the corresponding *Args map.
//   - "<name>visible text</name>" for links, resolved from the *Links map.
//
// Rendering is done by Render() in this package. The registerer calls Render
// at startup to bake the English form into the CheckType resource; the
// /translations endpoint (added in a follow-up PR) will call the same Render
// with localised templates.
//
// Steps that don't need any placeholders implement none of these interfaces —
// their Description/Resolution strings pass through Render as-is.

// DescriptionArgser reports the value substitutions used in Description().
// Values are inserted verbatim and are NOT translated.
type DescriptionArgser interface {
	DescriptionArgs() map[string]string
}

// DescriptionLinker reports the link URLs referenced in Description().
// A "<name>text</name>" span becomes an anchor pointing to the mapped URL.
type DescriptionLinker interface {
	DescriptionLinks() map[string]string
}

// ResolutionArgser reports the value substitutions used in Resolution().
type ResolutionArgser interface {
	ResolutionArgs() map[string]string
}

// ResolutionLinker reports the link URLs referenced in Resolution().
type ResolutionLinker interface {
	ResolutionLinks() map[string]string
}

// linkTagPattern matches a "<open>visible text</close>" span. RE2 doesn't
// support backreferences, so we capture the opening name and the closing name
// separately and enforce equality in Go code. The visible text may not contain
// '<' so we don't accidentally match across nested tags (we don't support
// nesting).
var linkTagPattern = regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9_-]*)>([^<]*)</([a-zA-Z][a-zA-Z0-9_-]*)>`)

// argPlaceholder builds the "{{name}}" token we substitute.
func argPlaceholder(name string) string {
	return "{{" + name + "}}"
}

// Render substitutes {{name}} argument placeholders and <name>text</name> link
// spans in template. It's the single source of truth for how backend-owned
// templated strings become the HTML that reaches the frontend.
//
// Args are inserted verbatim (no HTML escaping — they're trusted Go constants,
// never user input). Links are rendered as anchors with target=_blank and
// rel="noopener noreferrer". A tag whose name has no matching entry in links
// is left in place unchanged, which surfaces the mistake visibly rather than
// silently dropping content.
func Render(template string, args, links map[string]string) string {
	if template == "" {
		return template
	}
	rendered := template
	for name, value := range args {
		rendered = strings.ReplaceAll(rendered, argPlaceholder(name), value)
	}
	rendered = linkTagPattern.ReplaceAllStringFunc(rendered, func(match string) string {
		parts := linkTagPattern.FindStringSubmatch(match)
		if len(parts) != 4 {
			return match
		}
		openName, text, closeName := parts[1], parts[2], parts[3]
		if openName != closeName {
			// Mismatched tags — leave the match as-is so the mistake surfaces.
			return match
		}
		url, ok := links[openName]
		if !ok {
			return match
		}
		return fmt.Sprintf(`<a href=%q target="_blank" rel="noopener noreferrer">%s</a>`, url, text)
	})
	return rendered
}

// RenderDescription returns the rendered Description for a step, looking up
// its args/links from the DescriptionArgser and DescriptionLinker capability
// interfaces if the step implements them.
func RenderDescription(s Step) string {
	var args, links map[string]string
	if p, ok := s.(DescriptionArgser); ok {
		args = p.DescriptionArgs()
	}
	if p, ok := s.(DescriptionLinker); ok {
		links = p.DescriptionLinks()
	}
	return Render(s.Description(), args, links)
}

// RenderResolution returns the rendered Resolution for a step, looking up
// its args/links from the ResolutionArgser and ResolutionLinker capability
// interfaces if the step implements them.
func RenderResolution(s Step) string {
	var args, links map[string]string
	if p, ok := s.(ResolutionArgser); ok {
		args = p.ResolutionArgs()
	}
	if p, ok := s.(ResolutionLinker); ok {
		links = p.ResolutionLinks()
	}
	return Render(s.Resolution(), args, links)
}
