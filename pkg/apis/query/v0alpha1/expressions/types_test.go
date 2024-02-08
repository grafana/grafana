package expressions

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

func TestParseQueriesIntoQueryDataRequest(t *testing.T) {
	typesFile := "types.json"
	byType := GetQueryTypeDefinitions()

	created := time.Now()
	resourceVersion := fmt.Sprintf("%d", created.UnixMilli())

	defs := query.QueryTypeDefinitionList{
		TypeMeta: v1.TypeMeta{
			Kind:       "QueryTypeDefinitionList",
			APIVersion: query.APIVERSION,
		},
		ListMeta: v1.ListMeta{
			ResourceVersion: resourceVersion,
		},
	}
	for k, v := range byType {
		defs.Items = append(defs.Items, query.QueryTypeDefinition{
			TypeMeta: v1.TypeMeta{
				Kind: "QueryTypeDefinition",
			},
			ObjectMeta: v1.ObjectMeta{
				Name:              k,
				CreationTimestamp: v1.NewTime(created),
				ResourceVersion:   resourceVersion,
			},
			Spec: v,
		})
	}

	out, err := json.MarshalIndent(defs, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", out)

	err = os.WriteFile(typesFile, []byte(out), 0644)
	require.NoError(t, err, "error writing file")
}
