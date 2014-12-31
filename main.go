package main

import (
	"os"
	"runtime"

	"github.com/torkelo/grafana-pro/pkg/cmd"

	"github.com/codegangsta/cli"
)

const APP_VER = "0.1.0 Alpha"

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

func main() {
	app := cli.NewApp()
	app.Name = "Grafana Backend"
	app.Usage = "grafana web"
	app.Version = APP_VER
	app.Commands = []cli.Command{cmd.CmdWeb}
	app.Flags = append(app.Flags, []cli.Flag{}...)
	app.Run(os.Args)
}
