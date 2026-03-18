package elasticsearch

import (
	"testing"
)

func TestQuery_IsEsqlQuery(t *testing.T) {
	tests := []struct {
		name      string
		queryType *string
		want      bool
	}{
		{
			name:      "returns false when QueryLanguage is nil",
			queryType: nil,
			want:      false,
		},
		{
			name:      "returns false when QueryType is dsl",
			queryType: strPtr("dsl"),
			want:      false,
		},
		{
			name:      "returns true when QueryType is esql",
			queryType: strPtr("esql"),
			want:      true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{
				QueryType: tt.queryType,
			}
			if got := q.IsEsqlQuery(); got != tt.want {
				t.Errorf("Query.IsEsqlQuery() = %v, want %v", got, tt.want)
			}
		})
	}
}

func strPtr(s string) *string {
	return &s
}
