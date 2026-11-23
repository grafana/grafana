// Package v1beta1 serves the v0alpha1 kinds under provisioning.grafana.app/v1beta1.
// The schemas in *_schema_gen.go register the v1beta1 group version on the shared types.
package v1beta1

import (
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type (
	Repository          = v0alpha1.Repository
	RepositoryList      = v0alpha1.RepositoryList
	RepositoryJSONCodec = v0alpha1.RepositoryJSONCodec

	Connection          = v0alpha1.Connection
	ConnectionList      = v0alpha1.ConnectionList
	ConnectionJSONCodec = v0alpha1.ConnectionJSONCodec

	Job          = v0alpha1.Job
	JobList      = v0alpha1.JobList
	JobJSONCodec = v0alpha1.JobJSONCodec

	HistoricJob          = v0alpha1.HistoricJob
	HistoricJobList      = v0alpha1.HistoricJobList
	HistoricJobJSONCodec = v0alpha1.HistoricJobJSONCodec
)

var (
	NewRepository  = v0alpha1.NewRepository
	NewConnection  = v0alpha1.NewConnection
	NewJob         = v0alpha1.NewJob
	NewHistoricJob = v0alpha1.NewHistoricJob
)
