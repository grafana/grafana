package api

import (
	"encoding/json"
	"net/mail"
)

func jsonMap(data []byte) (map[string]string, error) {
	jsonMap := make(map[string]string)
	err := json.Unmarshal(data, &jsonMap)
	return jsonMap, err
}

func ValidateAndNormalizeEmail(email string) (string, error) {
	if email == "" {
		return "", nil
	}

	e, err := mail.ParseAddress(email)
	if err != nil {
		return "", err
	}

	return e.Address, nil
}
