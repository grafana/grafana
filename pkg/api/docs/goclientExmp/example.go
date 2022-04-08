package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	go_client "github.com/grafana/grafana/pkg/api/docs/clients/go"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

const (
	dashboardDataFolder = "data"
)

func recreateDataFolder(pwd string) error {
	err := os.RemoveAll(filepath.Join(pwd, dashboardDataFolder))
	if err != nil {
		log.Fatalf("Can't remove folder. %+v", err)
		return err
	}

	err = os.Mkdir(filepath.Join(pwd, dashboardDataFolder), 0755)
	if err != nil {
		log.Fatalf("Can't create folder. %+v", err)
		return err
	}
	return nil
}

func createFoldersInDataRepository(folders *[]dtos.FolderSearchHit, pwd string) error {
	for _, folder := range *folders {
		err := os.Mkdir(filepath.Join(pwd, dashboardDataFolder, folder.Title), 0755)
		if err != nil {
			log.Fatalf("Can't create folder. %+v", err)
			return err
		}
	}
	return nil
}

func main() {
	cfg := go_client.NewConfiguration()
	cfg.BasePath = "http://localhost:3000/api"
	client := go_client.NewAPIClient(cfg)

	pwd, err := os.Getwd()
	if err != nil {
		log.Fatalf("Can't get current repository. %+v", err)
		os.Exit(-1)
	}

	err = recreateDataFolder(pwd)
	if err != nil {
		logger.Error(err)
		os.Exit(-1)
	}

	basicAuth := context.WithValue(context.Background(), go_client.ContextBasicAuth, go_client.BasicAuth{
		UserName: "admin",
		Password: "password",
	})

	folders, _, err := client.FoldersApi.GetFolders(basicAuth, &go_client.FoldersApiGetFoldersOpts{Limit: 1000, Page: 1})
	if err != nil {
		logger.Error(err)
		os.Exit(-1)
	}

	err = createFoldersInDataRepository(&folders, pwd)
	if err != nil {
		logger.Error(err)
		os.Exit(-1)
	}

	for _, folder := range folders {
		dashboards, _, err := client.SearchApi.Search(basicAuth,
			&go_client.SearchApiSearchOpts{Query: "", FolderIds: []int64{folder.Id}, Limit: 1000, Page: 1, Starred: false})
		if err != nil {
			logger.Error(err)
			os.Exit(-1)
		}

		for _, dsboardWithUID := range dashboards {
			ds, _, err := client.DashboardsApi.GetDashboardByUID(basicAuth, dsboardWithUID.Uid)
			if err != nil {
				logger.Error(err)
			}
			err = writeIntoFile(&ds, folder.Title, dsboardWithUID.Uid, pwd)
			if err != nil {
				logger.Error(err)
			}
		}
	}
}

func writeIntoFile(response *dtos.DashboardFullWithMeta, folderUID string, dashboardUID string, pwd string) error {
	file, err := json.MarshalIndent(response, "", " ")
	if err != nil {
		log.Fatalf("Failed to write response into file. %+v", err)
		return err
	}
	err = os.WriteFile(filepath.Join(pwd, dashboardDataFolder, folderUID, dashboardUID), file, 0644)
	return err
}
