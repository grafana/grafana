package pluginscdn

import (
	"fmt"
	"net/url"
	"path"
	"strings"
)

// URLConstructor is a struct that can build CDN URLs for plugins on a remote CDN.
type URLConstructor struct {
	// cdnURLTemplate is absolute base url of the CDN. This string will be formatted
	// according to the rules specified in the URLFor method.
	cdnURLTemplate string

	// pluginID is the ID of the plugin.
	pluginID string

	// pluginVersion is the version of the plugin.
	pluginVersion string
}

// NewCDNURLConstructor creates a new URLConstructor for the specified template and plugin id + version combo.
func NewCDNURLConstructor(cdnURLTemplate string, pluginID string, pluginVersion string) URLConstructor {
	return URLConstructor{
		cdnURLTemplate: cdnURLTemplate,
		pluginID:       pluginID,
		pluginVersion:  pluginVersion,
	}
}

// URLFor returns a new *url.URL that points to an asset file for the CDN, plugin and plugin version
// specified by the current URLConstructor.
//
// c.cdnURLTemplate is used to build the string, the following substitutions are performed in it:
//
// - {id} -> plugin id
//
// - {version} -> plugin version
//
// - {assetPath} -> assetPath
//
// The asset path is sanitized via path.Clean (double slashes are removed, "../" is resolved, etc).
//
// The returned URL will be for a file, so it won't have a trailing slash.
func (c URLConstructor) URLFor(assetPath string) (*url.URL, error) {
	u, err := url.Parse(
		strings.TrimRight(
			strings.NewReplacer(
				"{id}", c.pluginID,
				"{version}", c.pluginVersion,
				"{assetPath}", strings.Trim(path.Clean("/"+assetPath+"/"), "/"),
			).Replace(c.cdnURLTemplate),
			"/",
		),
	)
	if err != nil {
		return nil, fmt.Errorf("url parse: %w", err)
	}
	return u, nil
}

// StringURLFor is like URLFor, but it returns the absolute URL as a string rather than *url.URL.
func (c URLConstructor) StringURLFor(assetPath string) (string, error) {
	u, err := c.URLFor(assetPath)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

// CDNBaseURL returns the base url from a plugins CDN template string.
func CDNBaseURL(cdnURLTemplate string) (string, error) {
	if cdnURLTemplate == "" {
		return "", nil
	}
	u, err := url.Parse(cdnURLTemplate)
	if err != nil {
		return "", fmt.Errorf("url parse: %w", err)
	}
	return u.Scheme + "://" + u.Host, nil
}
