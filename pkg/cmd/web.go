package cmd

import (
	"time"

	"github.com/codegangsta/cli"
	"github.com/siddontang/go-log/log"
	"github.com/torkelo/grafana-pro/pkg/configuration"
	"github.com/torkelo/grafana-pro/pkg/server"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

var CmdWeb = cli.Command{
	Name:        "web",
	Usage:       "Start Grafana Pro web server",
	Description: `Start Grafana Pro server`,
	Action:      runWeb,
	Flags:       []cli.Flag{},
}

func runWeb(*cli.Context) {
	log.Info("Starting Grafana-Pro v.1-alpha")

	setting.NewConfigContext()

	cfg := configuration.NewCfg(setting.HttpPort)
	server, err := server.NewServer(cfg)
	if err != nil {
		time.Sleep(time.Second)
		panic(err)
	}

	err = server.ListenAndServe()
	if err != nil {
		log.Error("ListenAndServe failed: ", err)
	}

	time.Sleep(time.Millisecond * 2000)

}
