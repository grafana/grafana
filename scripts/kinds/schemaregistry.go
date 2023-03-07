package main

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strconv"

	"github.com/grafana/thema"
	"github.com/grafana/thema/load"
)

// TODO - change this
const SchemaRegistryPath = "./pkg/kindsys/schemaregistry"

func main() {
	version, ok := os.LookupEnv("GRAFANA_VERSION")
	if !ok {
		panic(fmt.Errorf("GRAFANA_VERSION environment variable is missing"))
	}

	latestDir, err := findLatestDir(SchemaRegistryPath)
	if err != nil {
		panic(err)
	}

	nextSchemas, err := ioutil.ReadDir(SchemaRegistryPath + "/next")
	if err != nil {
		panic(err)
	}

	if latestDir == "" {
		err = copySchemas(nextSchemas, filepath.Join(SchemaRegistryPath, version))
		if err != nil {
			panic(err)
		}
	}

	for _, file := range nextSchemas {
		// File is new - no need to compare with existing
		if _, err := os.Stat(filepath.Join(SchemaRegistryPath, version, file.Name())); err != nil {
			continue
		}

		bytes, err := os.ReadFile(filepath.Join(SchemaRegistryPath, version, file.Name()))
		if err != nil {
			panic(err)
		}
		oldLin, err := load.LineageFromBytes(bytes)
		if err != nil {
			panic(err)
		}

		bytes, err = os.ReadFile(filepath.Join(SchemaRegistryPath, "next", file.Name()))
		if err != nil {
			panic(err)
		}
		newLin, err := load.LineageFromBytes(bytes)
		if err != nil {
			panic(err)
		}

		isAppendOnly := thema.IsAppendOnly(oldLin, newLin)
		fmt.Println(isAppendOnly)
	}
}

func findLatestDir(path string) (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	files, err := ioutil.ReadDir(path)
	if err != nil {
		return "", err
	}

	for _, file := range files {
		if !file.IsDir() {
			continue
		}

		parts := re.FindStringSubmatch(file.Name())
		if parts == nil || len(parts) < 4 {
			continue
		}

		version := make([]uint64, len(parts)-1)
		for i := 1; i < len(parts); i++ {
			version[i-1], _ = strconv.ParseUint(parts[i], 10, 32)
		}

		if isLess(latestVersion, version) {
			latestVersion = version
			latestDir = file.Name()
		}
	}

	return latestDir, nil
}

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

func copySchemas(files []os.FileInfo, dest string) error {
	_, err := os.Stat(dest)
	if err != nil {
		if !os.IsNotExist(err) {
			return err
		}

		if err := os.Mkdir(dest, 0644); err != nil {
			return err
		}
	}

	for _, file := range files {
		in, err := os.Open(filepath.Join(SchemaRegistryPath, "next", file.Name()))
		if err != nil {
			return err
		}
		defer in.Close()

		out, err := os.Create(filepath.Join(dest, file.Name()))
		if err != nil {
			return err
		}
		defer func() {
			cerr := out.Close()
			if err == nil {
				err = cerr
			}
		}()

		if _, err = io.Copy(out, in); err != nil {
			return err
		}
		err = out.Sync()
	}

	return nil
}
