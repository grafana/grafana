package testutil

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/user"
)

type SignedInUser struct{}

func (SignedInUser) NewAnonymous() (*user.SignedInUser, error) {
	return readUser(`user-anonymous.json`)
}

func (SignedInUser) NewEditor() (*user.SignedInUser, error) {
	return readUser(`user-editor.json`)
}

func (SignedInUser) NewGrafanaAdmin() (*user.SignedInUser, error) {
	return readUser(`user-grafana-admin.json`)
}

func (SignedInUser) NewEmpty() (*user.SignedInUser, error) {
	return readUser(`user-empty.json`)
}

func (SignedInUser) NewServiceAccount() (*user.SignedInUser, error) {
	return readUser(`user-service-account-viewer.json`)
}

func (SignedInUser) NewViewer() (*user.SignedInUser, error) {
	return readUser(`user-viewer.json`)
}

func readUser(filename string) (*user.SignedInUser, error) {
	file, err := dataFS.Open(`data/` + filename)
	if err != nil {
		return nil, err
	}
	ret := new(user.SignedInUser)

	return ret, json.NewDecoder(file).Decode(ret)
}
