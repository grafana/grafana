package authz

import (
	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/legacy"
	"github.com/grafana/grafana/pkg/services/authz/legacy/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// re-export
type (
	ReadClient    = client.ReadClient
	CheckRequest  = client.CheckRequest
	CheckResponse = client.CheckResponse
	Contextual    = client.Contextual
	ListRequest   = client.ListRequest
	ItemChecker   = client.ItemChecker
)

func ProvideLegacy(cfg *setting.Cfg, db db.DB, features featuremgmt.FeatureToggles) *client.Client {
	channel := &inprocgrpc.Channel{}
	server := legacy.NewServer(legacysql.NewDatabaseProvider(db), log.New("authz-service"))
	openfgav1.RegisterOpenFGAServiceServer(channel, server)
	return legacy.NewClient(channel)
}

// FIXME: this is for multi-tenant read path
func NewLegacy() {
}
