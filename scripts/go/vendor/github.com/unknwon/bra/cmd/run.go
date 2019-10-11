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
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/unknwon/com"
	"github.com/unknwon/log"
	"github.com/urfave/cli"
	"gopkg.in/fsnotify/fsnotify.v1"

	"github.com/unknwon/bra/modules/setting"
)

var (
	lastBuild time.Time
	eventTime = make(map[string]int64)

	runningCmd  *exec.Cmd
	runningLock = &sync.Mutex{}
	shutdown    = make(chan bool)
)

var CmdRun = cli.Command{
	Name:   "run",
	Usage:  "start monitoring and notifying",
	Action: runRun,
	Flags:  []cli.Flag{},
}

// isTmpFile returns true if the event was for temporary files.
func isTmpFile(name string) bool {
	if strings.HasSuffix(strings.ToLower(name), ".tmp") {
		return true
	}
	return false
}

// hasWatchExt returns true if the file name has watched extension.
func hasWatchExt(name string) bool {
	for _, ext := range setting.Cfg.Run.WatchExts {
		if strings.HasSuffix(name, ext) {
			return true
		}
	}
	return false
}

// runCommand represents a command to run after notified.
type runCommand struct {
	Envs []string
	Name string
	Args []string
}

func (cmd *runCommand) String() string {
	if len(cmd.Envs) > 0 {
		return fmt.Sprintf("%v %s %v", cmd.Envs, cmd.Name, cmd.Args)
	}
	return fmt.Sprintf("%s %v", cmd.Name, cmd.Args)
}

func parseRunCommand(args []string) *runCommand {
	runCmd := new(runCommand)
	i := 0
	for _, arg := range args {
		if !strings.Contains(arg, "=") {
			break
		}
		runCmd.Envs = append(runCmd.Envs, arg)
		i++
	}

	if len(runCmd.Envs) > 0 {
		runCmd.Envs = append(runCmd.Envs, os.Environ()...)
	}

	runCmd.Name = args[i]
	runCmd.Args = args[i+1:]
	return runCmd
}

func parseRunCommands(cmds [][]string) []*runCommand {
	runCmds := make([]*runCommand, len(cmds))
	for i, args := range cmds {
		runCmds[i] = parseRunCommand(args)
	}
	return runCmds
}

func notify(cmds []*runCommand) {
	runningLock.Lock()
	defer func() {
		runningCmd = nil
		runningLock.Unlock()
	}()

	for _, cmd := range cmds {
		command := exec.Command(cmd.Name, cmd.Args...)
		command.Env = cmd.Envs
		command.Stdout = os.Stdout
		command.Stderr = os.Stderr
		if err := command.Start(); err != nil {
			log.Error("Fail to start command: %v - %v", cmd, err)
			fmt.Print("\x07")
			return
		}

		log.Debug("Running: %s", cmd)
		runningCmd = command
		done := make(chan error)
		go func() {
			done <- command.Wait()
		}()

		isShutdown := false
		select {
		case err := <-done:
			if isShutdown {
				return
			} else if err != nil {
				log.Warn("Fail to execute command: %v - %v", cmd, err)
				fmt.Print("\x07")
				return
			}
		case <-shutdown:
			isShutdown = true
			gracefulKill()
			return
		}
	}
	log.Info("Notify operations are done!")
}

func gracefulKill() {
	// Directly kill the process on Windows or under request.
	if runtime.GOOS == "windows" || !setting.Cfg.Run.GracefulKill {
		runningCmd.Process.Kill()
		return
	}

	// Given process a chance to exit itself.
	runningCmd.Process.Signal(os.Interrupt)

	// Wait for timeout, and force kill after that.
	for i := 0; i < setting.Cfg.Run.InterruptTimeout; i++ {
		time.Sleep(1 * time.Second)

		if runningCmd.ProcessState == nil || runningCmd.ProcessState.Exited() {
			return
		}
	}

	log.Info("Fail to graceful kill, force killing...")
	runningCmd.Process.Kill()
}

func catchSignals() {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM)
	<-sigs

	if runningCmd != nil {
		shutdown <- true
	}
	os.Exit(0)
}

func runRun(ctx *cli.Context) error {
	setup(ctx)

	go catchSignals()
	go notify(parseRunCommands(setting.Cfg.Run.InitCmds))

	watchPathes := append([]string{setting.WorkDir}, setting.Cfg.Run.WatchDirs...)
	if setting.Cfg.Run.WatchAll {
		subdirs := make([]string, 0, 10)
		for _, dir := range watchPathes[1:] {
			var dirs []string
			var err error
			if setting.Cfg.Run.FollowSymlinks {
				dirs, err = com.LgetAllSubDirs(setting.UnpackPath(dir))
			} else {
				dirs, err = com.GetAllSubDirs(setting.UnpackPath(dir))
			}

			if err != nil {
				log.Fatal("Fail to get sub-directories: %v", err)
			}

			for i := range dirs {
				if !setting.IgnoreDir(dirs[i]) {
					subdirs = append(subdirs, path.Join(dir, dirs[i]))
				}
			}
		}
		watchPathes = append(watchPathes, subdirs...)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal("Fail to create new watcher: %v", err)
	}
	defer watcher.Close()

	go func() {
		runCmds := parseRunCommands(setting.Cfg.Run.Cmds)

		for {
			select {
			case e := <-watcher.Events:
				needsNotify := true

				if isTmpFile(e.Name) || !hasWatchExt(e.Name) || setting.IgnoreFile(e.Name) {
					continue
				}

				// Prevent duplicated builds.
				if lastBuild.Add(time.Duration(setting.Cfg.Run.BuildDelay) * time.Millisecond).
					After(time.Now()) {
					continue
				}
				lastBuild = time.Now()

				showName := e.String()
				if !log.NonColor {
					showName = strings.Replace(showName, setting.WorkDir, "\033[47;30m$WORKDIR\033[0m", 1)
				}

				if e.Op&fsnotify.Remove != fsnotify.Remove && e.Op&fsnotify.Rename != fsnotify.Rename {
					mt, err := com.FileMTime(e.Name)
					if err != nil {
						log.Error("Fail to get file modify time: %v", err)
						continue
					}
					if eventTime[e.Name] == mt {
						log.Debug("Skipped %s", showName)
						needsNotify = false
					}
					eventTime[e.Name] = mt
				}

				if needsNotify {
					log.Info(showName)
					if runningCmd != nil && runningCmd.Process != nil {
						if runningCmd.Args[0] == "sudo" && runtime.GOOS == "linux" {
							// 给父进程发送一个TERM信号，试图杀死它和它的子进程
							rootCmd := exec.Command("sudo", "kill", "-TERM", com.ToStr(runningCmd.Process.Pid))
							rootCmd.Stdout = os.Stdout
							rootCmd.Stderr = os.Stderr
							if err := rootCmd.Run(); err != nil {
								log.Error("Fail to start rootCmd %s", err.Error())
								fmt.Print("\x07")
							}
						} else {
							shutdown <- true
						}
					}
					go notify(runCmds)
				}
			}
		}
	}()

	log.Info("Following directories are monitored:")
	for i, p := range watchPathes {
		if err = watcher.Add(setting.UnpackPath(p)); err != nil {
			log.Fatal("Fail to watch directory(%s): %v", p, err)
		}
		if i > 0 && !log.NonColor {
			p = strings.Replace(p, setting.WorkDir, "\033[47;30m$WORKDIR\033[0m", 1)
			p = strings.Replace(p, "$WORKDIR", "\033[47;30m$WORKDIR\033[0m", 1)
		}
		fmt.Printf("-> %s\n", p)
	}
	select {}
	return nil
}
