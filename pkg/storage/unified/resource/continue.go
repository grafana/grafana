package resource

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
)

// ContinueToken represents a pagination token for list operations.
type ContinueToken struct {
	// Namespace is the namespace to continue from. Only set for cross-namespace list queries.
	Namespace string `json:"ns,omitempty"`
	// Name is the name to continue from. Required for list resources, empty for list history.
	Name string `json:"n,omitempty"`
	// ResourceVersion is the resource version for pagination.
	// For list resources: the RV the list was performed at.
	// For list history: the last seen RV for pagination.
	ResourceVersion int64 `json:"v"`
	// SortAscending indicates the sort order (used by list history).
	SortAscending bool `json:"s,omitempty"`
}

func (c ContinueToken) String() string {
	b, _ := json.Marshal(c)
	return base64.StdEncoding.EncodeToString(b)
}

func GetContinueToken(token string) (*ContinueToken, error) {
	continueVal, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("error decoding continue token")
	}

	t := &ContinueToken{}
	err = json.Unmarshal(continueVal, t)
	if err != nil {
		return nil, err
	}

	return t, nil
}
