package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type summaryRow struct {
	Pkg    string `json:"pkg"`
	Test   string `json:"test"`
	Metric string `json:"metric"`
	Value  int64  `json:"value"`
}

func summarize(args []string) error {
	fs := flag.NewFlagSet("summarize", flag.ExitOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}
	dir := fs.Arg(0)
	if dir == "" {
		dir = "profiles"
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.pprof"))
	if err != nil {
		return err
	}
	enc := json.NewEncoder(os.Stdout)
	for _, f := range files {
		name := strings.TrimSuffix(filepath.Base(f), ".pprof")
		i := strings.LastIndex(name, ".")
		if i < 0 {
			continue
		}
		metric := name[i+1:]
		pkg := strings.ReplaceAll(name[:i], "__", "/")
		totals, err := attribute(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", f, err)
			continue
		}
		tests := make([]string, 0, len(totals))
		for t := range totals {
			tests = append(tests, t)
		}
		sort.Strings(tests)
		for _, t := range tests {
			if err := enc.Encode(summaryRow{Pkg: pkg, Test: t, Metric: metric, Value: totals[t]}); err != nil {
				return err
			}
		}
	}
	return nil
}

var testNameRe = regexp.MustCompile(`\.(TestIntegration[A-Za-z0-9_]*)`)

func attribute(file string) (map[string]int64, error) {
	out, err := exec.Command("go", "tool", "pprof", "-raw", file).Output()
	if err != nil {
		return nil, err
	}

	type sample struct {
		value int64
		ids   []string
	}
	var samples []sample
	funcs := map[string]string{}
	sect, last := "", ""

	for _, line := range strings.Split(string(out), "\n") {
		switch {
		case strings.HasPrefix(line, "Samples:"):
			sect = "samples"
			continue
		case strings.HasPrefix(line, "Locations"):
			sect = "locs"
			continue
		case strings.HasPrefix(line, "Mappings"):
			sect = ""
			continue
		}
		switch sect {
		case "samples":
			trimmed := strings.TrimLeft(line, " \t")
			if trimmed == "" || trimmed[0] < '0' || trimmed[0] > '9' {
				continue
			}
			pos := strings.Index(trimmed, ":")
			if pos < 0 {
				continue
			}
			vals := strings.Fields(trimmed[:pos])
			if len(vals) < 2 {
				continue
			}
			v, err := strconv.ParseInt(vals[1], 10, 64)
			if err != nil {
				continue
			}
			samples = append(samples, sample{v, strings.Fields(trimmed[pos+1:])})
		case "locs":
			fields := strings.Fields(line)
			if len(fields) >= 4 && strings.HasSuffix(fields[0], ":") && strings.HasPrefix(fields[1], "0x") {
				last = strings.TrimSuffix(fields[0], ":")
				funcs[last] = fields[3]
			} else if last != "" && len(fields) > 0 {
				funcs[last] += " " + fields[0]
			}
		}
	}

	totals := map[string]int64{}
	for _, s := range samples {
		for j := len(s.ids) - 1; j >= 0; j-- {
			if m := testNameRe.FindStringSubmatch(funcs[s.ids[j]]); m != nil {
				totals[m[1]] += s.value
				break
			}
		}
	}
	return totals, nil
}
