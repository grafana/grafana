package elasticsearch

import (
	"testing"
)

func TestQuery_IsCodeEditorType(t *testing.T) {
	tests := []struct {
		name       string
		editorType *string
		want       bool
	}{
		{
			name:       "returns false when EditorType is nil",
			editorType: nil,
			want:       false,
		},
		{
			name:       "returns false when EditorType is empty string",
			editorType: strPtr(""),
			want:       false,
		},
		{
			name:       "returns false when EditorType is builder",
			editorType: strPtr("builder"),
			want:       false,
		},
		{
			name:       "returns true when EditorType is code",
			editorType: strPtr("code"),
			want:       true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{EditorType: tt.editorType}
			if got := q.IsCodeEditorType(); got != tt.want {
				t.Errorf("Query.IsCodeEditorType() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestQuery_IsEsqlQuery(t *testing.T) {
	tests := []struct {
		name          string
		editorType    *string
		queryLanguage *string
		want          bool
	}{
		{
			name:          "returns false when EditorType is nil",
			editorType:    nil,
			queryLanguage: strPtr("esql"),
			want:          false,
		},
		{
			name:          "returns false when EditorType is builder",
			editorType:    strPtr("builder"),
			queryLanguage: strPtr("esql"),
			want:          false,
		},
		{
			name:          "returns false when EditorType is code but QueryLanguage is nil",
			editorType:    strPtr("code"),
			queryLanguage: nil,
			want:          false,
		},
		{
			name:          "returns false when EditorType is code but QueryLanguage is raw_dsl",
			editorType:    strPtr("code"),
			queryLanguage: strPtr("raw_dsl"),
			want:          false,
		},
		{
			name:          "returns true when EditorType is code and QueryLanguage is esql",
			editorType:    strPtr("code"),
			queryLanguage: strPtr("esql"),
			want:          true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &Query{
				EditorType:    tt.editorType,
				QueryLanguage: tt.queryLanguage,
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
