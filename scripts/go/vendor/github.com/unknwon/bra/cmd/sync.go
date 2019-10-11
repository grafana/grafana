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

package cmd

import (
	"io"
	"net"
	"os"
	"path"
	"strings"
	"time"

	"github.com/unknwon/com"
	"github.com/unknwon/log"
	"github.com/urfave/cli"
	"gopkg.in/fsnotify/fsnotify.v1"

	"github.com/unknwon/bra/modules/setting"
)

var CmdSync = cli.Command{
	Name:   "sync",
	Usage:  "keep syncing two end points",
	Action: runSync,
	Flags: []cli.Flag{
		cli.StringFlag{Name: "mode, m", Value: "", Usage: "run mode"},
	},
}

func receiveHandler(conn net.Conn) {
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().String()
	p := make([]byte, 1024)
	n, err := conn.Read(p)
	if err != nil {
		log.Error("Cannot read header(%s): %v", remoteAddr, err)
		return
	} else if n == 0 {
		log.Error("Empty header(%s)", remoteAddr)
		return
	}

	fileName := string(p[:n])
	log.Info("File: %s", fileName)
	os.MkdirAll(path.Dir(fileName), os.ModePerm)
	f, err := os.Create(fileName)
	if err != nil {
		log.Error("Fail to create file(%s:%s): %v", remoteAddr, fileName, err)
		return
	}
	defer f.Close()

	conn.Write([]byte("ok"))

	_, err = io.Copy(f, conn)
	for {
		buffer := make([]byte, 1024*200)
		n, err := conn.Read(buffer)
		//blockSize := int64(n)
		_ = n
		if err != nil && err != io.EOF {
			log.Error("Cannot read(%s:%s): %v", remoteAddr, fileName, err)
		} else if err == io.EOF {
			break
		}
	}
	if err != nil {
		log.Error("Fail to receive file(%s:%s): %v\n", remoteAddr, fileName, err)
		return
	}
	log.Info("File received: %s", fileName)
}

func runServer(ctx *cli.Context) {
	if len(setting.Cfg.Sync.ListenAddr) == 0 {
		log.Fatal("Listen address cannot be empty")
	}

	l, err := net.Listen("tcp", setting.Cfg.Sync.ListenAddr)
	if err != nil {
		log.Fatal("Fail to start server on listening(%s): %v", setting.Cfg.Sync.ListenAddr, err)
	}

	log.Info("Listening on %s...", setting.Cfg.Sync.ListenAddr)
	for {
		conn, err := l.Accept()
		if err != nil {
			if ne, ok := err.(net.Error); !ok || !ne.Temporary() {
				log.Warn("Network error when accpet: %v", err)
			}
			continue
		}
		go receiveHandler(conn)
	}
}

func sendFile(fileName string) {
	f, err := os.Open(fileName)
	if err != nil {
		log.Error("Fail to open file: %v", err)
		return
	}
	defer f.Close()

	fi, err := os.Stat(fileName)
	if err != nil {
		log.Error("Fail to stat file: %v", err)
		return
	}

	fileName = strings.Replace(fileName, "\\", "/", -1) //path.Base()
	log.Info("File name: %s; size: %s", fileName, com.HumaneFileSize(uint64(fi.Size())))

	conn, err := net.Dial("tcp", setting.Cfg.Sync.RemoteAddr)
	if err != nil {
		log.Error("Fail to establish connection: %v", err)
		return
	}
	defer conn.Close()

	log.Info("Connection established")

	conn.Write([]byte(fileName))
	p := make([]byte, 2)
	_, err = conn.Read(p)
	if err != nil {
		log.Error("Cannot get response from server: %v", err)
		return
	} else if string(p) != "ok" {
		log.Error("Invalid response: %s", string(p))
		return
	}

	log.Info("Header sent")

	start := time.Now()
	_, err = io.Copy(conn, f)
	if err != nil {
		log.Error("Fail to send file(%s): %v", fileName, err)
		return
	}
	spend := time.Since(start)
	log.Info("File sent, speed: %s/s", com.HumaneFileSize(uint64((fi.Size()*1000000000/int64(spend))/1024)))
}

func runClient(ctx *cli.Context) {
	if len(setting.Cfg.Sync.RemoteAddr) == 0 {
		log.Fatal("Remote address cannot be empty")
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal("Fail to create new watcher: %v", err)
	}
	defer watcher.Close()

	go func() {
		for {
			select {
			case e := <-watcher.Events:
				if isTmpFile(e.Name) {
					continue
				}

				if e.Op&fsnotify.Create == fsnotify.Create ||
					e.Op&fsnotify.Write == fsnotify.Write {
					if com.IsDir(e.Name) {
						log.Warn("Hasn't support directory yet")
						continue
					}
					sendFile(strings.TrimPrefix(e.Name, setting.WorkDir+"/"))
				}
			}
		}
	}()

	if err = watcher.Add(setting.WorkDir); err != nil {
		log.Fatal("Fail to watch directory(%s): %v", setting.WorkDir, err)
	}

	dirs, err := com.GetAllSubDirs(setting.WorkDir)
	if err != nil {
		log.Fatal("Fail to get subdirectories(%s): %v", setting.WorkDir, err)
	}

	for _, dir := range dirs {
		if err = watcher.Add(path.Join(setting.WorkDir, dir)); err != nil {
			log.Fatal("Fail to watch directory(%s): %v", path.Join(setting.WorkDir, dir), err)
		}
	}

	log.Info("Start watching...")
	select {}
}

func runSync(ctx *cli.Context) error {
	setup(ctx)

	switch ctx.String("mode") {
	case "server":
		runServer(ctx)
	case "client":
		runClient(ctx)
	default:
		log.Fatal("Unrecognized run mode: %s", ctx.String("mode"))
	}
	return nil
}
