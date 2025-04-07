package resource

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
)

type ContinueToken struct {
	StartOffset     int64 `json:"o"`
	ResourceVersion int64 `json:"v"`
	SortAscending   bool  `json:"s"`
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
