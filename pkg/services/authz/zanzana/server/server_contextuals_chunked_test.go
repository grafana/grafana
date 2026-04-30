package server

import (
	"fmt"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestBuildContextualTupleChunks(t *testing.T) {
	s := &Server{cfg: setting.ZanzanaServerSettings{ContextualTeamsChunkSize: 25}}
	base := &openfgav1.ContextualTupleKeys{TupleKeys: []*openfgav1.TupleKey{{User: "u", Relation: "r", Object: "o1"}}}
	var teamTuples []*openfgav1.TupleKey
	for i := 0; i < 30; i++ {
		teamTuples = append(teamTuples, common.NewTuple("u", common.RelationTeamMember, common.NewTypedIdent(common.TypeTeam, fmt.Sprintf("t%d", i))))
	}
	chunks := s.buildContextualTupleChunks(base, teamTuples)
	require.Len(t, chunks, 2) // 25+5
	require.Len(t, chunks[0].GetTupleKeys(), 26) // 1 base + 25
	require.Len(t, chunks[1].GetTupleKeys(), 6)  // 1 base + 5
}

func singleBatchCheck(allowed bool) *openfgav1.BatchCheckSingleResult {
	return &openfgav1.BatchCheckSingleResult{CheckResult: &openfgav1.BatchCheckSingleResult_Allowed{Allowed: allowed}}
}

func TestOrBatchCheckSingleResult(t *testing.T) {
	allow := singleBatchCheck(true)
	deny := singleBatchCheck(false)
	denyB := singleBatchCheck(false)

	require.Equal(t, allow, orBatchCheckSingleResult(deny, allow))
	require.Equal(t, allow, orBatchCheckSingleResult(allow, deny))
	require.Equal(t, deny, orBatchCheckSingleResult(deny, denyB))
}
