package commands

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

func removeCommand(c utils.CommandLine) error {
	pluginID := c.Args().First()
	if pluginID == "" {
		return errors.New("missing plugin parameter")
	}

	err := uninstallPlugin(context.Background(), pluginID, c)
	if err != nil {
		if strings.Contains(err.Error(), "no such file or directory") {
			return fmt.Errorf("plugin does not exist")
		}
		return err
	} else {
		logRestartNotice()
	}

	return nil
}
