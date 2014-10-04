package main

import (
	"os"
	"runtime"

	"github.com/codegangsta/cli"
	"github.com/torkelo/grafana-pro/pkg/cmd"
)

const APP_VER = "0.1.0 Alpha"

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
}

func main() {
	app := cli.NewApp()
	app.Name = "Grafana Pro"
	app.Usage = "Grafana Pro Service"
	app.Version = APP_VER
	app.Commands = []cli.Command{
		cmd.CmdWeb,
	}
	app.Flags = append(app.Flags, []cli.Flag{}...)
	app.Run(os.Args)
}
