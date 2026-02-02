package bmc

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/bhdcodes"

	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana/pkg/api/bmc/external"
	"github.com/grafana/grafana/pkg/api/bmc/localization"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func (p *PluginsAPI) RequireLocalizationFeature(c *contextmodel.ReqContext) {
	if !external.FeatureFlagBHDLocalization.Enabled(c.Req, c.SignedInUser) {
		c.JSON(404, map[string]interface{}{"message": "Not found"})
		return
	}
}

func (p *PluginsAPI) CheckLanguage(c *contextmodel.ReqContext) {
	language := c.Query("lang")
	if !localization.IsSupportedLocale(localization.Locale(language)) {
		c.JSON(404, map[string]interface{}{"message": localization.ErrInvalidLanguage.Error()})
		return
	}
}

func (p *PluginsAPI) GetLocalesJson(c *contextmodel.ReqContext) response.Response {
	query := localization.Query{OrgID: c.OrgID, Lang: c.Query("lang")}
	result, err := localization.GetLocalesJson(c, p.store.WithDbSession, query)
	if err != nil {
		if errors.Is(localization.ErrInvalidLanguage, err) || errors.Is(localization.ErrBadRequest, err) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, localization.ErrUnexpected.Error(), err)
	}
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) GetLocalesJsonByUID(c *contextmodel.ReqContext) response.Response {
	resourceUID := web.Params(c.Req)[":uid"]
	query := localization.Query{OrgID: c.OrgID, ResourceUID: resourceUID, Lang: c.Query("lang")}
	result, err := localization.GetLocalesJsonByUid(c, p.store.WithDbSession, query)
	if err != nil {
		if errors.Is(localization.ErrInvalidLanguage, err) || errors.Is(localization.ErrBadRequest, err) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, localization.ErrUnexpected.Error(), err)
	}
	return response.JSON(http.StatusOK, &result)
}

func (p *PluginsAPI) UpdateLocalesJsonByLang(c *contextmodel.ReqContext) response.Response {
	resourceUID := web.Params(c.Req)[":uid"]
	query := localization.Query{OrgID: c.OrgID, ResourceUID: resourceUID, Lang: c.Query("lang")}
	err := localization.UpdateLocalesJsonByLang(c, p.store.WithTransactionalDbSession, query)
	if err != nil {
		if errors.Is(localization.ErrInvalidLanguage, err) || errors.Is(localization.ErrBadRequest, err) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, localization.ErrUnexpected.Error(), err)
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Locale updated successfully", "bhdCode": bhdcodes.SuccessLocaleUpdated})
}

func (p *PluginsAPI) GetGlobalLocalesJson(c *contextmodel.ReqContext) response.Response {
	query := localization.Query{OrgID: c.OrgID, ResourceUID: "*"}
	result, err := localization.GetGlobalLocalesJson(c, p.store.WithDbSession, query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, localization.ErrUnexpected.Error(), err)
	}
	return response.JSON(http.StatusOK, result.Locales)
}

func (p *PluginsAPI) UpdateGlobalLocalesJson(c *contextmodel.ReqContext) response.Response {
	query := localization.Query{OrgID: c.OrgID, ResourceUID: "*"}
	err := localization.UpdateGlobalLocalesJSON(c, p.store.WithDbSession, query)
	if err != nil {
		if errors.Is(err, localization.ErrExceedMaxAllowedKeys) {
			return response.Error(http.StatusBadRequest, "Maximum key limit exceeded", err)
		}
		return response.Error(http.StatusInternalServerError, localization.ErrUnexpected.Error(), err)
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Locale updated successfully", "bhdCode": bhdcodes.SuccessLocaleUpdated})
}
