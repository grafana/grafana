package main

import (
	"os"
	"os/signal"
	"runtime"
	"strconv"

	"github.com/grafana/grafana/pkg/cmd"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/codegangsta/cli"
)

var version = "master"
var commit = "NA"
var buildstamp string

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

func main() {
	buildstampInt64, _ := strconv.ParseInt(buildstamp, 10, 64)

	setting.BuildVersion = version
	setting.BuildCommit = commit
	setting.BuildStamp = buildstampInt64

	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt)
		<-c
		os.Exit(0)
	}()

	app := cli.NewApp()
	app.Name = "Grafana Backend"
	app.Usage = "grafana web"
	app.Version = version
	app.Commands = []cli.Command{
		cmd.ListOrgs,
		cmd.CreateOrg,
		cmd.DeleteOrg,
		cmd.ImportDashboard,
		cmd.ListDataSources,
		cmd.CreateDataSource,
		cmd.DescribeDataSource,
		cmd.DeleteDataSource,
		cmd.Web}
	app.Flags = append(app.Flags, []cli.Flag{
		cli.StringFlag{
			Name:  "config",
			Usage: "path to grafana.ini config file",
		},
		cli.StringFlag{
			Name:  "pidfile",
			Usage: "path to pidfile",
		},
	}...)

	app.Run(os.Args)

	log.Close()
}
