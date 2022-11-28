// docstarget is a port of the `docs-target` Grafana GitHub action: https://github.com/grafana/grafana-github-actions/tree/298819e3a2706409728eda34246cd12d33cfb368/docs-target.
package main

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/urfave/cli/v2"
)

const (
	// MAX_SAFE_COMPONENT_LENGTH is the max safe segment length for coercion.
	// https://github.com/npm/node-semver/blob/c1d1952141d84a62b1df683f651e123d2d81ca1b/internal/constants.js#L9-L10
	MAX_SAFE_COMPONENT_LENGTH = 16
)

var (
	// coerceRegexp extract anything that could conceivably be a part of a valid semver.
	// https://github.com/npm/node-semver/blob/c1d1952141d84a62b1df683f651e123d2d81ca1b/internal/re.js#L125-L131.
	coerceRegexp = regexp.MustCompile(
		strings.Join([]string{
			// Unnecessary fmt.Sprintf calls left in for alignment.
			fmt.Sprintf(`(^|[^\d])`),
			fmt.Sprintf(`(\d{1,%d})`, MAX_SAFE_COMPONENT_LENGTH),
			fmt.Sprintf(`(?:\.(\d{1,%d}))?`, MAX_SAFE_COMPONENT_LENGTH),
			fmt.Sprintf(`(?:\.(\d{1,%d}))?`, MAX_SAFE_COMPONENT_LENGTH),
			fmt.Sprintf(`(?:$|[^\d])`),
		}, ""))
	patchSuffixRegexp = regexp.MustCompile(fmt.Sprintf(`\.\d{1,%d}$`, MAX_SAFE_COMPONENT_LENGTH))
)

type semverOpts = struct {
	RTL bool
}

// DocsTarget the CLI Action for determining the docs target for a provided git reference.
// It expects a single context argument which is the git reference.
func DocsTarget(c *cli.Context) error {
	if c.NArg() != 1 {
		var message string
		if c.NArg() == 0 {
			message = "ERROR: missing required argument <reference>"
		}
		if c.NArg() > 1 {
			message = "ERROR: too many arguments"
		}

		if err := cli.ShowSubcommandHelp(c); err != nil {
			return cli.Exit(err.Error(), 1)
		}
		return cli.Exit(message, 1)
	}

	reference := c.Args().Get(0)
	target, err := docsTarget(reference)
	if err != nil {
		return err
	}

	fmt.Println(target)
	return nil
}

// docsTarget maps the given git reference (branch or tag name) to the corresponding
// documentation subfolder.
// The output will be "v<MAJOR>.<MINOR>" or "next".
// Known references "main" and "master" are mapped to "next".
// For all other references that approximate a semantic version
// but deviate perhaps by having a prefix, should be coerced into a reasonable output.
// If a reference does not map to one of the described outputs, either directly
// or through coercion, an error is returned.
// https://github.com/grafana/grafana-github-actions/blob/298819e3a2706409728eda34246cd12d33cfb368/docs-target/map.ts#L16-L28
func docsTarget(ref string) (string, error) {
	if ref == "main" || ref == "master" {
		return "next", nil
	}

	version, err := coerce(ref, semverOpts{})
	if err != nil {
		return "", err

	}

	return "v" + patchSuffixRegexp.ReplaceAllLiteralString(version, ""), nil
}

// coerce is a port of the `coerce` function in NPM package `semver` package but it returns a string instead of a semver type.
// https://github.com/npm/node-semver/blob/c1d1952141d84a62b1df683f651e123d2d81ca1b/functions/coerce.jsp
// The JavaScript function uses null to indicate a failed but this function returns an error instead.
// It incorrectly deviates from the JavaScript implementation for the following cases:
// - Coercing '9'.repeat(16) as "9999999999999999.0.0".
// - Coercing `a${'9'.repeat(16)}` as "9999999999999999.0.0".
// - Coercing `${'9'.repeat(16)}a` as "9999999999999999.0.0".
// - Coercing `${'9'.repeat(16)}.4.7.4` as "9999999999999999.4.7".
// I do not yet understand why this is the case.
// Especially as the JavaScript implementation expects '1'.repeat(16) to be coerced to "1111111111111111.0.0"
func coerce(version string, options semverOpts) (string, error) {
	var match []string
	if !options.RTL {
		// In JavaScript the the return value of String.prototype.match(/regexp/) is:
		// > An Array whose contents depend on the presence or absence of the global (g) flag, or null if no matches are found.
		// > If the g flag is not used, only the first complete match and its related capturing groups are returned. In this case, match() will return the same result as RegExp.prototype.exec() (an array with some extra properties).
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/match#return_value
		match = coerceRegexp.FindStringSubmatch(version)
	} else {
		panic("Right-to-left (RTL) matching is not implemented")
	}

	if len(match) == 0 {
		return "", errors.New("unable to coerce version to semver")
	}

	major := match[2]
	minor := "0"
	if match[3] != "" {
		minor = match[3]
	}
	patch := "0"
	if match[4] != "" {
		patch = match[4]
	}
	return fmt.Sprintf("%s.%s.%s", major, minor, patch), nil
}
