// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

// Bra(Brilliant Ridiculous Assistant) is a command line utility tool.
package main

import (
	"os"
	"runtime"

	"github.com/urfave/cli"

	"github.com/unknwon/bra/cmd"
)

const APP_VER = "0.4.2.0603"

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
	cmd.AppVer = APP_VER
}

func main() {
	app := cli.NewApp()
	app.Name = "Bra"
	app.Usage = "Brilliant Ridiculous Assistant is a command line utility tool."
	app.Version = APP_VER
	app.Commands = []cli.Command{
		cmd.CmdInit,
		cmd.CmdRun,
		cmd.CmdSync,
	}
	app.Flags = append(app.Flags, []cli.Flag{}...)
	app.Run(os.Args)
}
