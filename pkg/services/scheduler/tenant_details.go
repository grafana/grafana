package reporting_scheduler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/hashicorp/golang-lru/v2/expirable"
)

var timeToCacheFor time.Duration = time.Hour * 24 * 2
var maxTenantsToCacheFor int = 1000
var Cache = expirable.NewLRU[int64, string](maxTenantsToCacheFor, nil, timeToCacheFor)

func GetTenantDetails(orgId int64) (*dtos.TenantDetails, error) {
	url := fmt.Sprintf("http://tms:8000/tms/api/v1/tenants/%v", orgId)
	tenantDetails := &dtos.TenantDetails{}
	err := getJson(url, tenantDetails)
	if err != nil {
		return nil, err
	}
	return tenantDetails, nil
}

func GetCachedTenantDomain(orgId int64) (string, error) {
	r, ok := Cache.Get(orgId)
	if ok {
		slog.Info(fmt.Sprintf("Fetched tenant domain from cache for tenant %v", orgId))
		return r, nil
	}

	tenant, err := GetTenantDetails(orgId)
	if err != nil {
		return "", nil
	} else {
		if tenant.Domain != "" {
			Cache.Add(orgId, tenant.Domain)
			slog.Info(fmt.Sprintf("Added tenant domain to cache for tenant %v", orgId))
		}
	}
	return tenant.Domain, nil

}

func getJson(url string, target interface{}) error {
	client := &http.Client{}
	r, err := client.Get(url)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
