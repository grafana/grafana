// author (kmejdi)
package api

import (
	"io/ioutil"
	"net/http"
	"regexp"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/infra/log"
)

var rebrandingLogger = log.New("rebranding")

func GetTenantReBranding(c *contextmodel.ReqContext) response.Response {
	if !setting.FeatureFlagEnabled {
		return response.Respond(200, "").
			SetHeader("Content-Type", "text/css; charset=UTF-8")
	}

	imsToken, err := GetIMSToken(c, c.OrgID, c.UserID)
	if err != nil && setting.Env != "development" {
		return response.Error(401, "Failed to authenticate", err)
	}

	if setting.FeatureFlagEnabled {
		rebrandingFeature := false
		featureFlags := external.GetTenantFeaturesFromService(c.OrgID, imsToken)
		for i := range featureFlags {
			if featureFlags[i].Name == "branding" {
				rebrandingFeature = true
				break
			}
		}

		if !rebrandingFeature {
			return response.Respond(200, "").
				SetHeader("Content-Type", "text/css; charset=UTF-8")
		}
	}

	cssVar := []string{
		"--logo-light:", "--logo:",
	}
	mainCss := getMainCss(imsToken)
	extractedCss := extract(mainCss, cssVar)

	return response.Respond(200, extractedCss).SetHeader("Content-Type", "text/css; charset=UTF-8").
		SetHeader("Cache-Control", "public, max-age=31536000")
}

func getMainCss(imsToken string) string {
	fileKey := "/public/css/custom.css"
	url := setting.UcsEndpoint + fileKey
	method := "GET"
	rebrandingLogger.Info("Requesting custom css file",
		"url", url,
		"method", method,
	)
	client := &http.Client{}
	req, _ := http.NewRequest(method, url, nil)

	req.Header.Add("Authorization", "Bearer "+imsToken)

	res, err := client.Do(req)
	if err != nil {
		rebrandingLogger.Error("Failed to send a request to ucs service",
			"error", err.Error(),
		)
		return ""
	}
	defer res.Body.Close()

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		rebrandingLogger.Error("Failed to read body response",
			"error", err.Error(),
		)
		return ""
	}
	return string(body)
}

func extract(content string, classNames []string) string {
	rebrandingLogger.Info("Extracting needed classes from the custom css file")
	if content == "" {
		return ""
	}
	if len(classNames) == 0 {
		return ""
	}
	cssVars := make([]string, 0)
	for _, cssVar := range classNames {
		regExpStr := cssVar + ".*;"
		reg, err := regexp.Compile(regExpStr)
		if err == nil {
			cssVars = append(cssVars, reg.FindString(content))
		}
	}

	target := ":root { \n"
	for _, class := range cssVars {
		target += "--bmc" + class[1:] + "\n"
	}
	target += "} \n"

	target += ".logo-helix { \n \tbackground-image: var(--bmc" + classNames[1][1:len(classNames[1])-1] + "); \n } \n"
	target += ".logo-helix.logo-light { \n \tbackground-image: var(--bmc" + classNames[0][1:len(classNames[0])-1] + "); \n } \n"
	return target
}
