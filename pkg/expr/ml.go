package expr

import (
	"gonum.org/v1/gonum/graph/simple"
)

const (
	mlDatasourceID = -200

	// DatasourceUID is the string constant used as the datasource name in requests
	// to identify it as an expression command when use in Datasource.UID.
	MLDatasourceUID = "__ml__"

	mlPluginID = "grafana-ml-app"
)

func (s *Service) buildMLNode(dp *simple.DirectedGraph, rn *rawNode, req *Request) (Node, error) {
	return nil, nil
}
