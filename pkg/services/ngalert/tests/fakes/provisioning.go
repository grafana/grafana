package fakes

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeProvisioningStore struct {
	Calls                       []Call
	Records                     map[int64]map[string]models.Provenance
	GetProvenanceFunc           func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenancesFunc          func(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error)
	GetProvenancesByUIDsFunc    func(ctx context.Context, orgID int64, resourceType string, uids []string) (map[string]models.Provenance, error)
	SetProvenanceFunc           func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenanceFunc        func(ctx context.Context, o models.Provisionable, org int64) error
	GetManagerPropertiesFunc    func(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error)
	GetAllManagerPropertiesFunc func(ctx context.Context, org int64, resourceType string) (map[string]utils.ManagerProperties, error)
	SetManagerPropertiesFunc    func(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error
	SourceURLs                  map[int64]map[string]string
	SetSourceURLFunc            func(ctx context.Context, o models.Provisionable, org int64, sourceURL string) error
	GetSourceURLFunc            func(ctx context.Context, o models.Provisionable, org int64) (string, error)
	GetSourceURLsFunc           func(ctx context.Context, org int64, resourceType string) (map[string]string, error)
	GetSourceURLsByUIDsFunc     func(ctx context.Context, org int64, resourceType string, uids []string) (map[string]string, error)
}

func NewFakeProvisioningStore() *FakeProvisioningStore {
	return &FakeProvisioningStore{
		Records:    map[int64]map[string]models.Provenance{},
		SourceURLs: map[int64]map[string]string{},
	}
}

func (f *FakeProvisioningStore) GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenance", Arguments: []any{ctx, o, org}})
	if f.GetProvenanceFunc != nil {
		return f.GetProvenanceFunc(ctx, o, org)
	}
	if val, ok := f.Records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return prov, nil
		}
	}
	return models.ProvenanceNone, nil
}

func (f *FakeProvisioningStore) GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenances", Arguments: []any{ctx, orgID, resourceType}})
	if f.GetProvenancesFunc != nil {
		return f.GetProvenancesFunc(ctx, orgID, resourceType)
	}
	results := make(map[string]models.Provenance)
	if val, ok := f.Records[orgID]; ok {
		for k, v := range val {
			if before, ok0 := strings.CutSuffix(k, resourceType); ok0 {
				results[before] = v
			}
		}
	}
	return results, nil
}

func (f *FakeProvisioningStore) GetProvenancesByUIDs(ctx context.Context, orgID int64, resourceType string, uids []string) (map[string]models.Provenance, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetProvenancesByUIDs", Arguments: []any{ctx, orgID, resourceType, uids}})
	if f.GetProvenancesByUIDsFunc != nil {
		return f.GetProvenancesByUIDsFunc(ctx, orgID, resourceType, uids)
	}
	results := make(map[string]models.Provenance)
	if val, ok := f.Records[orgID]; ok {
		for _, uid := range uids {
			key := uid + resourceType
			if prov, ok := val[key]; ok {
				results[uid] = prov
			}
		}
	}
	return results, nil
}

func (f *FakeProvisioningStore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	f.Calls = append(f.Calls, Call{MethodName: "SetProvenance", Arguments: []any{ctx, o, org, p}})
	if f.SetProvenanceFunc != nil {
		return f.SetProvenanceFunc(ctx, o, org, p)
	}
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	if val, ok := f.Records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	f.Records[org][o.ResourceID()+o.ResourceType()] = p
	return nil
}

func (f *FakeProvisioningStore) DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error {
	f.Calls = append(f.Calls, Call{MethodName: "DeleteProvenance", Arguments: []any{ctx, o, org}})
	if f.DeleteProvenanceFunc != nil {
		return f.DeleteProvenanceFunc(ctx, o, org)
	}
	if val, ok := f.Records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	if val, ok := f.SourceURLs[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	return nil
}

func (f *FakeProvisioningStore) GetManagerProperties(ctx context.Context, o models.Provisionable, org int64) (utils.ManagerProperties, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetManagerProperties", Arguments: []any{ctx, o, org}})
	if f.GetManagerPropertiesFunc != nil {
		return f.GetManagerPropertiesFunc(ctx, o, org)
	}
	// Derive from stored provenance for backwards compat with tests that only set provenance.
	if val, ok := f.Records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return models.ProvenanceToManagerProperties(prov), nil
		}
	}
	return utils.ManagerProperties{}, nil
}

func (f *FakeProvisioningStore) GetAllManagerProperties(ctx context.Context, org int64, resourceType string) (map[string]utils.ManagerProperties, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetAllManagerProperties", Arguments: []any{ctx, org, resourceType}})
	if f.GetAllManagerPropertiesFunc != nil {
		return f.GetAllManagerPropertiesFunc(ctx, org, resourceType)
	}
	result := make(map[string]utils.ManagerProperties)
	if provenances, ok := f.Records[org]; ok {
		for key, prov := range provenances {
			if before, ok0 := strings.CutSuffix(key, resourceType); ok0 {
				result[before] = models.ProvenanceToManagerProperties(prov)
			}
		}
	}
	return result, nil
}

func (f *FakeProvisioningStore) SetManagerProperties(ctx context.Context, o models.Provisionable, org int64, m utils.ManagerProperties) error {
	f.Calls = append(f.Calls, Call{MethodName: "SetManagerProperties", Arguments: []any{ctx, o, org, m}})
	if f.SetManagerPropertiesFunc != nil {
		return f.SetManagerPropertiesFunc(ctx, o, org, m)
	}
	// Store the derived provenance so existing provenance-based tests still work.
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	f.Records[org][o.ResourceID()+o.ResourceType()] = models.ManagerPropertiesToProvenance(m)
	return nil
}

func (f *FakeProvisioningStore) sourceKey(o models.Provisionable) string {
	return o.ResourceID() + o.ResourceType()
}

func (f *FakeProvisioningStore) SetSourceURL(ctx context.Context, o models.Provisionable, org int64, sourceURL string) error {
	f.Calls = append(f.Calls, Call{MethodName: "SetSourceURL", Arguments: []any{ctx, o, org, sourceURL}})
	if f.SetSourceURLFunc != nil {
		return f.SetSourceURLFunc(ctx, o, org, sourceURL)
	}
	if f.SourceURLs == nil {
		f.SourceURLs = map[int64]map[string]string{}
	}
	if f.Records == nil {
		f.Records = map[int64]map[string]models.Provenance{}
	}
	key := f.sourceKey(o)
	if _, ok := f.Records[org]; !ok {
		f.Records[org] = map[string]models.Provenance{}
	}
	if _, ok := f.Records[org][key]; !ok {
		if sourceURL == "" {
			return nil
		}
		return fmt.Errorf("failed to store source URL: provenance record does not exist")
	}
	if _, ok := f.SourceURLs[org]; !ok {
		f.SourceURLs[org] = map[string]string{}
	}
	if sourceURL == "" {
		delete(f.SourceURLs[org], key)
		return nil
	}
	f.SourceURLs[org][key] = sourceURL
	return nil
}

func (f *FakeProvisioningStore) GetSourceURL(ctx context.Context, o models.Provisionable, org int64) (string, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetSourceURL", Arguments: []any{ctx, o, org}})
	if f.GetSourceURLFunc != nil {
		return f.GetSourceURLFunc(ctx, o, org)
	}
	if val, ok := f.SourceURLs[org]; ok {
		return val[f.sourceKey(o)], nil
	}
	return "", nil
}

func (f *FakeProvisioningStore) GetSourceURLs(ctx context.Context, org int64, resourceType string) (map[string]string, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetSourceURLs", Arguments: []any{ctx, org, resourceType}})
	if f.GetSourceURLsFunc != nil {
		return f.GetSourceURLsFunc(ctx, org, resourceType)
	}
	results := make(map[string]string)
	if val, ok := f.SourceURLs[org]; ok {
		for k, v := range val {
			if v == "" {
				continue
			}
			if before, ok0 := strings.CutSuffix(k, resourceType); ok0 {
				results[before] = v
			}
		}
	}
	return results, nil
}

func (f *FakeProvisioningStore) GetSourceURLsByUIDs(ctx context.Context, org int64, resourceType string, uids []string) (map[string]string, error) {
	f.Calls = append(f.Calls, Call{MethodName: "GetSourceURLsByUIDs", Arguments: []any{ctx, org, resourceType, uids}})
	if f.GetSourceURLsByUIDsFunc != nil {
		return f.GetSourceURLsByUIDsFunc(ctx, org, resourceType, uids)
	}
	results := make(map[string]string)
	if val, ok := f.SourceURLs[org]; ok {
		for _, uid := range uids {
			if url, ok := val[uid+resourceType]; ok && url != "" {
				results[uid] = url
			}
		}
	}
	return results, nil
}
