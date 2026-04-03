package main

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
)

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
	var easyFlags []string
	for _, f := range flags {
		s, ok := classifyFlag(f.Name, idx)
		if !ok {
			continue
		}
		counts[s]++
		if s == statusNotMigrated && isBEEasy(f.Name, idx) {
			easyFlags = append(easyFlags, f.Name)
		}
	}
	sort.Strings(easyFlags)

	total := counts[statusMigrated] + counts[statusPartial] + counts[statusNotMigrated]
	fmt.Printf("Total (with usage): %d\n", total)
	fmt.Printf("Migrated:           %d\n", counts[statusMigrated])
	fmt.Printf("Partial:            %d\n", counts[statusPartial])
	fmt.Printf("Not migrated:       %d\n", counts[statusNotMigrated])
	fmt.Printf("\nEasy to migrate (%d):\n", len(easyFlags))
	for _, name := range easyFlags {
		fmt.Printf("  %s\n", name)
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