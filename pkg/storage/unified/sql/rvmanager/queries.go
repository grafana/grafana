package rvmanager

import (
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type SqlResourceUpdateRVRequest struct {
	sqltemplate.SQLTemplate
	GUIDToRV          map[string]int64
	GUIDToSnowflakeRV map[string]int64
}

func (r SqlResourceUpdateRVRequest) Validate() error {
	return nil // TODO
}

func (r SqlResourceUpdateRVRequest) SlashFunc() string {
	if r.DialectName() == "postgres" {
		return "CHR(47)"
	}

	return "CHAR(47)"
}

func (r SqlResourceUpdateRVRequest) TildeFunc() string {
	if r.DialectName() == "postgres" {
		return "CHR(126)"
	}

	return "CHAR(126)"
}

type ResourceVersionResponse struct {
	ResourceVersion int64
	CurrentEpoch    int64
}

func (r *ResourceVersionResponse) Results() (*ResourceVersionResponse, error) {
	return r, nil
}

type sqlResourceVersionGetRequest struct {
	sqltemplate.SQLTemplate
	Group, Resource string
	ReadOnly        bool
	Response        *ResourceVersionResponse
}

func (r sqlResourceVersionGetRequest) Validate() error {
	return nil // TODO
}
func (r sqlResourceVersionGetRequest) Results() (*ResourceVersionResponse, error) {
	return &ResourceVersionResponse{
		ResourceVersion: r.Response.ResourceVersion,
		CurrentEpoch:    r.Response.CurrentEpoch,
	}, nil
}

type SqlResourceVersionUpsertRequest struct {
	sqltemplate.SQLTemplate
	Group, Resource string
	ResourceVersion int64
}

func (r SqlResourceVersionUpsertRequest) Validate() error {
	return nil // TODO
}

type SqlResourceVersionGetRequest struct {
	sqltemplate.SQLTemplate
	Group, Resource string
	ReadOnly        bool
	Response        *ResourceVersionResponse
}

func (r SqlResourceVersionGetRequest) Validate() error {
	return nil // TODO
}
func (r SqlResourceVersionGetRequest) Results() (*ResourceVersionResponse, error) {
	return &ResourceVersionResponse{
		ResourceVersion: r.Response.ResourceVersion,
		CurrentEpoch:    r.Response.CurrentEpoch,
	}, nil
}
