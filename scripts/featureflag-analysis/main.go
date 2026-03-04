package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type graphiteMetric struct {
	Name     string `json:"name"`
	Value    int    `json:"value"`
	Interval int    `json:"interval"`
	MType    string `json:"mtype"`
	Time     int64  `json:"time"`
}

func main() {
	roots := []string{"."}
	if len(os.Args) > 1 {
		roots = os.Args[1:]
	}

	flags, err := readFlags(filepath.Join(roots[0], "pkg/services/featuremgmt/toggles_gen.csv"))
	if err != nil {
		log.Fatalf("reading flags: %v", err)
	}

	fmt.Fprintln(os.Stderr, "Building file index...")
	idx, err := buildIndex(roots)
	if err != nil {
		log.Fatalf("building index: %v", err)
	}
	fmt.Fprintf(os.Stderr, "Indexed: beOld=%d beNew=%d feOld=%d feNew=%d files\n",
		len(idx.beOld), len(idx.beNew), len(idx.feOld), len(idx.feNew))

	counts := map[migrationStatus]int{}
	byStatus := map[migrationStatus][]string{}
	for _, f := range flags {
		s := classifyFlag(f.Name, idx)
		counts[s]++
		byStatus[s] = append(byStatus[s], f.Name)
	}

	total := len(flags)
	fmt.Fprintf(os.Stderr, "Total: %d | Migrated: %d | Partial: %d | Not migrated: %d | No usage: %d\n",
		total, counts[statusMigrated], counts[statusPartial], counts[statusNotMigrated], counts[statusNoUsage])
	fmt.Fprintf(os.Stderr, "No usage: %v\n", byStatus[statusNoUsage])

	ts := time.Now().Unix()
	metrics := []graphiteMetric{
		{"grafana.ci-code.featureflags.total", total, 86400, "gauge", ts},
		{"grafana.ci-code.featureflags.migrated", counts[statusMigrated], 86400, "gauge", ts},
		{"grafana.ci-code.featureflags.partial", counts[statusPartial], 86400, "gauge", ts},
		{"grafana.ci-code.featureflags.not_migrated", counts[statusNotMigrated], 86400, "gauge", ts},
		{"grafana.ci-code.featureflags.no_usage", counts[statusNoUsage], 86400, "gauge", ts},
	}

	if err := json.NewEncoder(os.Stdout).Encode(metrics); err != nil {
		log.Fatalf("encoding output: %v", err)
	}
}

func readFlags(csvPath string) ([]flagInfo, error) {
	f, err := os.Open(csvPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	records, err := csv.NewReader(f).ReadAll()
	if err != nil {
		return nil, err
	}

	var flags []flagInfo
	for i, row := range records {
		if i == 0 || len(row) < 4 {
			continue
		}
		flags = append(flags, flagInfo{Name: row[1], Owner: row[3]})
	}
	return flags, nil
}
