package database

import (
	"fmt"
	"github.com/google/uuid"
)

func generateAccessToken() (string, error) {
	token, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", token[:]), nil
}
