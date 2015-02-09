package apikeygen

import (
	"strconv"

	"github.com/grafana/grafana/pkg/util"
)

type KeyGenResult struct {
	HashedKey      string
	JsonKeyEncoded string
}

type ApiKeyJson struct {
	Key       string
	AccountId int64
	Name      string
}

func GenerateNewKey(accountId int64, name string) KeyGenResult {
	jsonKey := ApiKeyJson{}

	jsonKey.AccountId = accountId
	jsonKey.Name = name
	jsonKey.Key = util.GetRandomString(32)

	result := KeyGenResult{}
	result.HashedKey = util.EncodePassword([]byte(jsonKey.Key), []byte(strconv.FormatInt(accountId, 10)))

}
