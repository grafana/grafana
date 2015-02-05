package core

import (
	"encoding/json"
)

type PK []interface{}

func NewPK(pks ...interface{}) *PK {
	p := PK(pks)
	return &p
}

func (p *PK) ToString() (string, error) {
	bs, err := json.Marshal(*p)
	if err != nil {
		return "", nil
	}

	return string(bs), nil
}

func (p *PK) FromString(content string) error {
	return json.Unmarshal([]byte(content), p)
}
