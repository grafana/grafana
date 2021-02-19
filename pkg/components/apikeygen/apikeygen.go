package apikeygen

import (
	"encoding/base64"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/util"
)

var ErrInvalidApiKey = errors.New("Invalid Api Key")

type KeyGenResult struct {
	HashedKey    string
	ClientSecret string
}

type ApiKeyJson struct {
	Key   string `json:"k"`
	Name  string `json:"n"`
	OrgId int64  `json:"id"`
}

func New(orgId int64, name string) (KeyGenResult, error) {
	result := KeyGenResult{}

	jsonKey := ApiKeyJson{}
	jsonKey.OrgId = orgId
	jsonKey.Name = name
	var err error
	jsonKey.Key, err = util.GetRandomString(32)
	if err != nil {
		return result, err
	}

	result.HashedKey, err = util.EncodePassword(jsonKey.Key, name)
	if err != nil {
		return result, err
	}

	jsonString, err := json.Marshal(jsonKey)
	if err != nil {
		return result, err
	}

	result.ClientSecret = base64.StdEncoding.EncodeToString(jsonString)
	return result, nil
}

func Decode(keyString string) (*ApiKeyJson, error) {
	jsonString, err := base64.StdEncoding.DecodeString(keyString)
	if err != nil {
		return nil, ErrInvalidApiKey
	}

	var keyObj ApiKeyJson
	err = json.Unmarshal(jsonString, &keyObj)
	if err != nil {
		return nil, ErrInvalidApiKey
	}

	return &keyObj, nil
}

func IsValid(key *ApiKeyJson, hashedKey string) (bool, error) {
	check, err := util.EncodePassword(key.Key, key.Name)
	if err != nil {
		return false, err
	}
	return check == hashedKey, nil
}
