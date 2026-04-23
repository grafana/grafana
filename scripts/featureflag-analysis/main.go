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
			s = statusUnknown
		}
		easy := ""
		counts[s]++
		if s == statusNotMigrated && isBEEasy(f.Name, idx) {
			easyFlags = append(easyFlags, f.Name)
			easy = "easy"
		}
		fmt.Printf("%s\t%s\t%s\t%s\n", f.Name, f.Owner, string(s), easy)
	}
	sort.Strings(easyFlags)

	total := counts[statusMigrated] + counts[statusPartial] + counts[statusNotMigrated] + counts[statusUnknown]
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintf(os.Stderr, "Total:        %d\n", total)
	fmt.Fprintf(os.Stderr, "Migrated:     %d\n", counts[statusMigrated])
	fmt.Fprintf(os.Stderr, "Partial:      %d\n", counts[statusPartial])
	fmt.Fprintf(os.Stderr, "Not migrated: %d\n", counts[statusNotMigrated])
	fmt.Fprintf(os.Stderr, "Unknown:      %d\n", counts[statusUnknown])
	fmt.Fprintf(os.Stderr, "\nEasy to migrate (%d):\n", len(easyFlags))
	for _, name := range easyFlags {
		fmt.Fprintf(os.Stderr, "  %s\n", name)
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