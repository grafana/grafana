package ftp

import (
	"errors"
	"fmt"
	"github.com/jlaffaye/ftp"
	"os"
	"path/filepath"
	"strings"
)

type _FTP struct {
	config ConnConfig
	client *ftp.ServerConn
}

func newFTP(config ConnConfig) _Instance {
	return &_FTP{config, nil}
}

func (s *_FTP) Ping() error {
	err := s.Connect()
	if err != nil {
		return err
	}
	defer s.Close()
	return nil
}

func (s *_FTP) UploadFile(fileUpload FileUpload) error {
	// Recursively create folder in FTP server
	folders := strings.Split(fileUpload.FTPFolder, "/")
	currentDir, _ := s.client.CurrentDir()
	for _, folder := range folders {

		current, _ := s.client.CurrentDir()
		current = filepath.Join(current, folder)

		if err := s.client.ChangeDir(current); err != nil {
			// create folder
			if err := s.client.MakeDir(folder); err != nil {
				return errors.New(fmt.Sprintf("Failed to create folder %s: %s", folder, err.Error()))
			}
		}
		// change to folder
		if err := s.client.ChangeDir(current); err != nil {
			return errors.New(fmt.Sprintf("Failed to change to folder %s: %s", folder, err.Error()))
		}
	}
	// change back to original directory
	if err := s.client.ChangeDir(currentDir); err != nil {
		return errors.New(fmt.Sprintf("Failed to change to folder %s: %s", currentDir, err.Error()))
	}

	// Open and read local file
	file, err := os.Open(fileUpload.LocalFilepath)
	if err != nil {
		return errors.New(fmt.Sprintf("Failed to open file %s: %v", fileUpload.LocalFilepath, err))
	}
	defer file.Close()

	path := filepath.Join(fileUpload.FTPFolder, fileUpload.FTPFileName)
	if s.client.Stor(path, file); err != nil {
		return errors.New(fmt.Sprintf("Failed to upload file: %s", err.Error()))
	}

	return nil
}

func (s *_FTP) Connect() error {
	url := fmt.Sprintf("%v:%v", s.config.Host, s.config.Port)
	c, err := ftp.Dial(url, ftp.DialWithTimeout(s.config.Timeout))
	if err != nil {
		return err
	}
	err = c.Login(s.config.User, s.config.Password)
	if err != nil {
		return errors.New(fmt.Sprintf("Failed to connect to server: %s", err.Error()))
	}
	s.client = c
	return nil
}

// Close closes the connection to the FTP server.
func (s *_FTP) Close() error {
	if s.client != nil {
		defer s.client.Quit()
	}
	return nil
}