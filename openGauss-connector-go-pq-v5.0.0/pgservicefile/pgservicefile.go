// Package pgservicefile is a parser for PostgreSQL service files (e.g. .pg_service.conf).
package pgservicefile

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

type Service struct {
	Name     string
	Settings map[string]string
}

type ServiceFile struct {
	Services       []*Service
	servicesByName map[string]*Service
}

// GetService returns the named service.
func (sf *ServiceFile) GetService(name string) (*Service, error) {
	service, present := sf.servicesByName[name]
	if !present {
		return nil, errors.New("not found")
	}
	return service, nil
}

// ReadServiceFile reads the file at path and parses it into a Servicefile.
func ReadServiceFile(path string) (*ServiceFile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return ParseServiceFile(f)
}

// ParseServiceFile reads r and parses it into a Servicefile.
func ParseServiceFile(r io.Reader) (*ServiceFile, error) {
	serviceFile := &ServiceFile{}

	var service *Service
	scanner := bufio.NewScanner(r)
	lineNum := 0
	for scanner.Scan() {
		lineNum += 1
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" || strings.HasPrefix(line, "#") {
			// ignore comments and empty lines
		} else if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			service = &Service{Name: line[1 : len(line)-1], Settings: make(map[string]string)}
			serviceFile.Services = append(serviceFile.Services, service)
		} else {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				return nil, fmt.Errorf("unable to parse line %d", lineNum)
			}

			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])

			service.Settings[key] = value
		}
	}

	serviceFile.servicesByName = make(map[string]*Service, len(serviceFile.Services))
	for _, service := range serviceFile.Services {
		serviceFile.servicesByName[service.Name] = service
	}

	return serviceFile, scanner.Err()
}
