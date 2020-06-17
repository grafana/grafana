package api

import (
	"io/ioutil"
	"log"
	"os"

	"github.com/grafana/grafana/pkg/models"
)

// GET /api/sqlatlas
func GetSQLAtlasKey(c *models.ReqContext) Response {
	file, err := os.Open("data/engine_token.txt")
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()
	b, err := ioutil.ReadAll(file)

	return JSON(200, b)
}
