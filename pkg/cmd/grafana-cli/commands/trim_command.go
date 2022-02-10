package commands

import (
	"bytes"
	"encoding/json"
	gerrors "errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"cuelang.org/go/cue/errors"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/schema/load"
)

func (cmd Command) trimResource(c utils.CommandLine) error {
	filename := c.String("dashboard")
	if filename == "" {
		return gerrors.New("must specify dashboard file path with --dashboard")
	}
	apply := c.Bool("apply")

	f, err := os.Open(filepath.Clean(filename))
	if err != nil {
		return err
	}
	b, err := io.ReadAll(f)
	if err != nil {
		return err
	}

	res := schema.Resource{Value: string(b), Name: filename}
	sch, err := load.DistDashboardFamily(paths)
	if err != nil {
		return fmt.Errorf("error while loading dashboard scuemata, err: %w", err)
	}

	var out schema.Resource
	if apply {
		out, err = schema.ApplyDefaults(res, sch.CUE())
	} else {
		out, err = schema.TrimDefaults(res, sch.CUE())
	}

	if err != nil {
		return gerrors.New(errors.Details(err, nil))
	}

	b = []byte(out.Value.(string))
	var buf bytes.Buffer
	err = json.Indent(&buf, b, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(buf.String())
	return nil
}
