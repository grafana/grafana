package commands

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
)

func validateInput(c CommandLine, pluginFolder string) error {
	arg := c.Args().First()
	if arg == "" {
		return errors.New("please specify plugin to install")
	}

	pluginsDir := c.PluginDirectory()
	if pluginsDir == "" {
		return errors.New("missing pluginsDir flag")
	}

	fileInfo, err := os.Stat(pluginsDir)
	if err != nil {
		if err = os.MkdirAll(pluginsDir, os.ModePerm); err != nil {
			return fmt.Errorf("pluginsDir (%s) is not a writable directory", pluginsDir)
		}
		return nil
	}

	if !fileInfo.IsDir() {
		return errors.New("path is not a directory")
	}

	return nil
}

func installCommand(c CommandLine) error {
	pluginFolder := c.PluginDirectory()
	if err := validateInput(c, pluginFolder); err != nil {
		return err
	}

	pluginToInstall := c.Args().First()
	version := c.Args().Get(1)

	return InstallPlugin(pluginToInstall, version, c)
}

func InstallPlugin(pluginName, version string, c CommandLine) error {
	pluginFolder := c.PluginDirectory()
	downloadURL := c.PluginURL()
	if downloadURL == "" {
		plugin, err := s.GetPlugin(pluginName, c.RepoDirectory())
		if err != nil {
			return err
		}

		v, err := SelectVersion(plugin, version)
		if err != nil {
			return err
		}

		if version == "" {
			version = v.Version
		}
		downloadURL = fmt.Sprintf("%s/%s/versions/%s/download",
			c.GlobalString("repo"),
			pluginName,
			version)
	}

	logger.Infof("installing %v @ %v\n", pluginName, version)
	logger.Infof("from url: %v\n", downloadURL)
	logger.Infof("into: %v\n", pluginFolder)
	logger.Info("\n")

	err := downloadFile(pluginName, pluginFolder, downloadURL)
	if err != nil {
		return err
	}

	logger.Infof("%s Installed %s successfully \n", color.GreenString("✔"), pluginName)

	res, _ := s.ReadPlugin(pluginFolder, pluginName)
	for _, v := range res.Dependencies.Plugins {
		InstallPlugin(v.Id, "", c)
		logger.Infof("Installed dependency: %v ✔\n", v.Id)
	}

	return err
}

func SelectVersion(plugin m.Plugin, version string) (m.Version, error) {
	if version == "" {
		return plugin.Versions[0], nil
	}

	for _, v := range plugin.Versions {
		if v.Version == version {
			return v, nil
		}
	}

	return m.Version{}, errors.New("Could not find the version your looking for")
}

func RemoveGitBuildFromName(pluginName, filename string) string {
	r := regexp.MustCompile("^[a-zA-Z0-9_.-]*/")
	return r.ReplaceAllString(filename, pluginName+"/")
}

var retryCount = 0
var permissionsDeniedMessage = "Could not create %s. Permission denied. Make sure you have write access to plugindir"

func downloadFile(pluginName, filePath, url string) (err error) {
	defer func() {
		if r := recover(); r != nil {
			retryCount++
			if retryCount < 3 {
				fmt.Println("Failed downloading. Will retry once.")
				err = downloadFile(pluginName, filePath, url)
			} else {
				failure := fmt.Sprintf("%v", r)
				if failure == "runtime error: makeslice: len out of range" {
					err = fmt.Errorf("Corrupt http response from source. Please try again.\n")
				} else {
					panic(r)
				}
			}
		}
	}()

	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	r, err := zip.NewReader(bytes.NewReader(body), resp.ContentLength)
	if err != nil {
		return err
	}
	for _, zf := range r.File {
		newFile := path.Join(filePath, RemoveGitBuildFromName(pluginName, zf.Name))

		if zf.FileInfo().IsDir() {
			err := os.Mkdir(newFile, 0777)
			if PermissionsError(err) {
				return fmt.Errorf(permissionsDeniedMessage, newFile)
			}
		} else {
			dst, err := os.Create(newFile)
			if PermissionsError(err) {
				return fmt.Errorf(permissionsDeniedMessage, newFile)
			}

			src, err := zf.Open()
			if err != nil {
				logger.Errorf("Failed to extract file: %v", err)
			}

			io.Copy(dst, src)
			dst.Close()
			src.Close()
		}
	}

	return nil
}

func PermissionsError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "permission denied")
}
