package apikeygenprefix

import (
	"encoding/hex"
	"hash/crc32"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

const GrafanaPrefix = "gl"

type KeyGenResult struct {
	HashedKey    string
	ClientSecret string
}

type PrefixedKey struct {
	ServiceID string
	Secret    string
	Checksum  string
}

func (p *PrefixedKey) IsValid(hashedKey string) (bool, error) {
	check, err := util.EncodePassword(p.Secret, p.Checksum)
	if err != nil {
		return false, err
	}
	return check == hashedKey, nil
}

func (p *PrefixedKey) key() string {
	return GrafanaPrefix + p.ServiceID + "_" + p.Secret
}

func (p *PrefixedKey) CalculateChecksum() string {
	checksum := crc32.ChecksumIEEE([]byte(p.key()))
	//checksum to []byte
	checksumBytes := make([]byte, 4)
	checksumBytes[0] = byte(checksum)
	checksumBytes[1] = byte(checksum >> 8)
	checksumBytes[2] = byte(checksum >> 16)
	checksumBytes[3] = byte(checksum >> 24)

	return hex.EncodeToString(checksumBytes)
}

func (p *PrefixedKey) String() string {
	return p.key() + "_" + p.Checksum
}

func New(serviceID string) (KeyGenResult, error) {
	result := KeyGenResult{}

	secret, err := util.GetRandomString(32)
	if err != nil {
		return result, err
	}

	key := PrefixedKey{ServiceID: serviceID, Secret: secret, Checksum: ""}
	key.Checksum = key.CalculateChecksum()

	result.HashedKey, err = util.EncodePassword(secret, key.Checksum)
	if err != nil {
		return result, err
	}

	result.ClientSecret = key.String()

	return result, nil
}

func Decode(keyString string) (*PrefixedKey, error) {
	key := &PrefixedKey{}
	if !strings.HasPrefix(keyString, GrafanaPrefix) {
		return nil, &ErrInvalidApiKey{}
	}

	parts := strings.Split(keyString, "_")
	if len(parts) != 3 {
		return nil, &ErrInvalidApiKey{}
	}

	key.ServiceID = strings.TrimPrefix(parts[0], "gl")
	key.Secret = parts[1]
	key.Checksum = parts[2]

	if key.CalculateChecksum() != key.Checksum {
		return nil, &ErrInvalidApiKey{}
	}

	return key, nil
}
