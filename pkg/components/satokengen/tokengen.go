package satokengen

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

func (p *PrefixedKey) Hash() (string, error) {
	hash, err := util.EncodePassword(p.Secret, p.Checksum)
	if err != nil {
		return "", err
	}
	return hash, nil
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

	result.HashedKey, err = key.Hash()
	if err != nil {
		return result, err
	}

	result.ClientSecret = key.String()

	return result, nil
}

func Decode(keyString string) (*PrefixedKey, error) {
	if !strings.HasPrefix(keyString, GrafanaPrefix) {
		return nil, &ErrInvalidApiKey{}
	}

	parts := strings.Split(keyString, "_")
	if len(parts) != 3 {
		return nil, &ErrInvalidApiKey{}
	}

	key := &PrefixedKey{
		ServiceID: strings.TrimPrefix(parts[0], GrafanaPrefix),
		Secret:    parts[1],
		Checksum:  parts[2],
	}
	if key.CalculateChecksum() != key.Checksum {
		return nil, &ErrInvalidApiKey{}
	}

	return key, nil
}
