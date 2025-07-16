// +build linux darwin

package commands

import (
  "os"
  "path/filepath"
  "syscall"
)

func chownPluginDirRecursively(pluginDir, pluginID string) {
  pluginPath := filepath.Join(pluginDir, pluginID)
  filepath.Walk(pluginPath, func(path string, info os.FileInfo, err error) error {
    if err != nil {
      return nil  
    }
    if stat, ok := info.Sys().(*syscall.Stat_t); ok {
      os.Chown(path, int(stat.Uid), int(stat.Gid)) 
    }
    return nil
  })
}
