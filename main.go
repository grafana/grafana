package main

import (
	"os"
	"runtime"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/cmd"

	"github.com/codegangsta/cli"
)

const APP_VER = "0.1.0 Alpha"

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

func main() {
	bus.InitBus()

	app := cli.NewApp()
	app.Name = "Grafana Pro"
	app.Usage = "Grafana Pro Service"
	app.Version = APP_VER
	app.Commands = []cli.Command{cmd.CmdWeb}
	app.Flags = append(app.Flags, []cli.Flag{}...)
	app.Run(os.Args)
}
