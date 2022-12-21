package pluginscdn

import (
	"fmt"
	"net/url"
	"path"
	"strings"
)

type URLConstructor struct {
	cdnBaseURL    string
	pluginID      string
	pluginVersion string
}

func NewCDNURLConstructor(cdnBaseURL string, pluginID string, pluginVersion string) URLConstructor {
	return URLConstructor{
		cdnBaseURL:    cdnBaseURL,
		pluginID:      pluginID,
		pluginVersion: pluginVersion,
	}
}

func (c URLConstructor) URLFor(assetPath string) (*url.URL, error) {
	u, err := url.Parse(
		strings.NewReplacer(
			"{id}", c.pluginID,
			"{version}", c.pluginVersion,
			"{assetPath}", strings.Trim(path.Clean("/"+assetPath+"/"), "/"),
		).Replace(c.cdnBaseURL),
	)
	if err != nil {
		return nil, fmt.Errorf("url parse: %w", err)
	}
	return u, nil
}

func (c URLConstructor) StringURLFor(assetPath string) (string, error) {
	u, err := c.URLFor(assetPath)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (c URLConstructor) RelativeURLFor(assetPath string) (string, error) {
	u, err := c.URLFor(assetPath)
	if err != nil {
		return "", err
	}
	return u.Path, nil
}

func (c URLConstructor) RelativeBaseURL() (string, error) {
	u, err := c.RelativeURLFor("")
	if err != nil {
		return "", err
	}
	return strings.TrimRight(u, "/"), nil
}

func RelativeURLForSystemJS(s string) string {
	const systemJSKey = "plugin-cdn/"
	return systemJSKey + strings.Split(s, "/"+systemJSKey)[1]
}
