package ftp

import (
	"errors"
	"fmt"
	"time"
)

type ConnConfig struct {
	Protocol      string
	Host          string
	Port          int
	User          string
	Password      string
	Timeout       time.Duration
	IgnoreHostKey bool
}

type FileUpload struct {
	LocalFilepath string
	FTPFolder     string
	FTPFileName   string
}

type _Instance interface {
	Ping() error
	Connect() error
	Close() error
	UploadFile(FileUpload) error
}

func NewInstance(config ConnConfig) (_Instance, error) {
	if config.Protocol == "sftp" {
		return newSFTP(config), nil
	}
	if config.Protocol == "ftp" {
		return newFTP(config), nil
	}
	return nil, errors.New(fmt.Sprintf("Protocol %s not supported", config.Protocol))
}