package commands

import (
	"archive/zip"
	"bytes"
	"errors"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	m "github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	s "github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"regexp"
)

func validateInput(c CommandLine, pluginFolder string) error {
	arg := c.Args().First()
	if arg == "" {
		return errors.New("please specify plugin to install")
	}

	pluginDir := c.GlobalString("path")
	if pluginDir == "" {
		return errors.New("missing path flag")
	}

	fileinfo, err := os.Stat(pluginDir)
	if err != nil && !fileinfo.IsDir() {
		return errors.New("path is not a directory")
	}

	return nil
}

func installCommand(c CommandLine) error {
	pluginFolder := c.GlobalString("path")
	if err := validateInput(c, pluginFolder); err != nil {
		return err
	}

	pluginToInstall := c.Args().First()
	version := c.Args().Get(1)

	if version == "" {
		log.Infof("version: latest\n")
	} else {
		log.Infof("version: %v\n", version)
	}

	return InstallPlugin(pluginToInstall, pluginFolder, version, c.GlobalString("repo"))
}

func InstallPlugin(pluginName, pluginFolder, version, repoUrl string) error {
	plugin, err := s.GetPlugin(pluginName, repoUrl)
	if err != nil {
		return err
	}

	v, err := SelectVersion(plugin, version)
	if err != nil {
		return err
	}

	url := v.Url
	commit := v.Commit

	if version == "" {
		version = v.Version
	}

	downloadURL := url + "/archive/" + commit + ".zip"

	log.Infof("installing %v @ %v\n", plugin.Id, version)
	log.Infof("from url: %v\n", downloadURL)
	log.Infof("on commit: %v\n", commit)
	log.Infof("into: %v\n", pluginFolder)

	err = downloadFile(plugin.Id, pluginFolder, downloadURL)
	if err == nil {
		log.Infof("Installed %v successfully ✔\n", plugin.Id)
	}

	res, _ := s.ReadPlugin(pluginFolder, pluginName)

	for _, v := range res.Dependency.Plugins {
		InstallPlugin(v.Id, pluginFolder, "", repoUrl)
		log.Infof("Installed Dependency: %v ✔\n", v.Id)
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

func RemoveGitBuildFromname(pluginname, filename string) string {
	r := regexp.MustCompile("^[a-zA-Z0-9_.-]*/")
	return r.ReplaceAllString(filename, pluginname+"/")
}

func downloadFile(pluginName, filepath, url string) (err error) {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	log.Infof("Got statuscode %s from %s\n", resp.Status, url)

	if resp.StatusCode == 302 || resp.StatusCode == 301 {
		str, _ := ioutil.ReadAll(resp.Body)
		log.Info("body %s\n\n", string(str))
	}

	r, err := zip.NewReader(bytes.NewReader(body), resp.ContentLength)
	if err != nil {
		return err
	}
	for _, zf := range r.File {
		newfile := path.Join(filepath, RemoveGitBuildFromname(pluginName, zf.Name))

		if zf.FileInfo().IsDir() {
			os.Mkdir(newfile, 0777)
		} else {
			dst, err := os.Create(newfile)
			if err != nil {
				log.Errorf("%v", err)
			}
			defer dst.Close()
			src, err := zf.Open()
			if err != nil {
				log.Errorf("%v", err)
			}
			defer src.Close()

			io.Copy(dst, src)
		}
	}

	return nil
}
