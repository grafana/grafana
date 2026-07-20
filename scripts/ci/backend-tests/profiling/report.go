package main

import (
	"bufio"
	_ "embed"
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"text/template"
)

//go:embed comment.tmpl
var commentTmpl string

var palette = []string{"#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"}

type testRow struct {
	Pkg, Test string
	DB        map[string]float64
	Avg       float64
}

type tableRow struct {
	N                     int
	Test, Pkg, Owner, Avg string
	DBTimes               []string
	CPU, Alloc            string
	Deltas                []string
}

type tmplData struct {
	Total       string
	Count       int
	CmpSummary  string
	Badges      string
	ColorsCSV   string
	XAxis       string
	Bars        []string
	DBs         []string
	HasProfiles bool
	CmpLabels   []string
	Rows        []tableRow
}

func report(args []string) error {
	fs := flag.NewFlagSet("report", flag.ExitOnError)
	csvOut := fs.String("csv", "", "write full timings CSV to this path")
	baselinePath := fs.String("baseline", "", "baseline timings CSV")
	previousPath := fs.String("previous", "", "previous run timings CSV")
	codeowners := fs.String("codeowners", ".github/CODEOWNERS", "CODEOWNERS file")
	if err := fs.Parse(args); err != nil {
		return err
	}
	dir := fs.Arg(0)
	if dir == "" {
		dir = "timings"
	}

	rows, dbs, err := loadTimings(dir)
	if err != nil {
		return err
	}
	profiles, err := loadProfiles(dir)
	if err != nil {
		return err
	}

	if *csvOut != "" {
		if err := writeCSV(*csvOut, rows, dbs); err != nil {
			return err
		}
	}

	type cmp struct {
		label string
		m     map[string]float64
	}
	var cmps []cmp
	for _, c := range []cmp{{"main", readTimingsCSV(*baselinePath)}, {"prev run", readTimingsCSV(*previousPath)}} {
		if c.m != nil {
			cmps = append(cmps, c)
		}
	}

	top := rows
	if len(top) > 20 {
		top = top[:20]
	}

	owners := loadOwners(*codeowners, top)
	var names []string
	seen := map[string]bool{}
	for _, r := range top {
		if o := owners[r.Pkg]; !seen[o] {
			seen[o] = true
			names = append(names, o)
		}
	}
	series := names
	if len(series) > len(palette) {
		series = append(append([]string{}, names[:len(palette)-1]...), "other")
	}
	seriesIdx := map[string]int{}
	for i, s := range series {
		seriesIdx[s] = i
	}
	colors := palette[:len(series)]

	var total float64
	for _, r := range rows {
		total += r.Avg
	}

	data := tmplData{
		Total:       fmtdur(total),
		Count:       len(rows),
		Badges:      badges(series, colors),
		ColorsCSV:   strings.Join(colors, ","),
		XAxis:       xAxis(len(top)),
		Bars:        bars(top, owners, series, seriesIdx),
		HasProfiles: len(profiles) > 0,
	}
	for _, db := range dbs {
		data.DBs = append(data.DBs, strings.ToUpper(db[:1])+db[1:])
	}
	var parts []string
	for _, c := range cmps {
		data.CmpLabels = append(data.CmpLabels, c.label)
		var t float64
		for _, v := range c.m {
			t += v
		}
		parts = append(parts, fmt.Sprintf("%s: %s, %s", c.label, fmtdur(t), fmtdelta(total-t)))
	}
	if len(parts) > 0 {
		data.CmpSummary = fmt.Sprintf(" (%s)", strings.Join(parts, " · "))
	}
	for i, r := range top {
		tr := tableRow{
			N: i + 1, Test: r.Test, Pkg: r.Pkg,
			Owner: owners[r.Pkg], Avg: num(r.Avg),
			CPU: "—", Alloc: "—",
		}
		for _, db := range dbs {
			if v, ok := r.DB[db]; ok {
				tr.DBTimes = append(tr.DBTimes, num(v))
			} else {
				tr.DBTimes = append(tr.DBTimes, "—")
			}
		}
		if p, ok := profiles[r.Pkg+"/"+r.Test]; ok {
			if p.cpuN > 0 {
				tr.CPU = fmtcpu(p.cpu / float64(p.cpuN))
			}
			if p.memN > 0 {
				tr.Alloc = fmtbytes(p.mem / float64(p.memN))
			}
		}
		for _, c := range cmps {
			if b, ok := c.m[r.Pkg+"/"+r.Test]; ok {
				tr.Deltas = append(tr.Deltas, fmtdelta(r.Avg-b))
			} else {
				tr.Deltas = append(tr.Deltas, "new")
			}
		}
		data.Rows = append(data.Rows, tr)
	}

	t, err := template.New("comment").Parse(commentTmpl)
	if err != nil {
		return err
	}
	return t.Execute(os.Stdout, data)
}

var dbRe = regexp.MustCompile(`test-timings-([a-z]+)-`)

func loadTimings(dir string) ([]testRow, []string, error) {
	type event struct {
		Action, Package, Test string
		Elapsed               float64
	}
	byTest := map[[2]string]map[string]float64{}
	dbSet := map[string]bool{}
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".json") {
			return err
		}
		m := dbRe.FindStringSubmatch(path)
		if m == nil {
			return nil
		}
		db := m[1]
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 1024*1024), 1024*1024)
		for sc.Scan() {
			var e event
			if json.Unmarshal(sc.Bytes(), &e) != nil {
				continue
			}
			if (e.Action != "pass" && e.Action != "fail") || e.Test == "" || strings.Contains(e.Test, "/") {
				continue
			}
			pkg := strings.TrimPrefix(e.Package, "github.com/grafana/grafana/")
			key := [2]string{pkg, e.Test}
			if byTest[key] == nil {
				byTest[key] = map[string]float64{}
			}
			if e.Elapsed > byTest[key][db] {
				byTest[key][db] = e.Elapsed
			}
			dbSet[db] = true
		}
		return sc.Err()
	})
	if err != nil {
		return nil, nil, err
	}
	var dbs []string
	for db := range dbSet {
		dbs = append(dbs, db)
	}
	sort.Strings(dbs)
	var rows []testRow
	for key, byDB := range byTest {
		var sum float64
		for _, v := range byDB {
			sum += v
		}
		avg := math.Round(sum/float64(len(byDB))*100) / 100
		rows = append(rows, testRow{Pkg: key[0], Test: key[1], DB: byDB, Avg: avg})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Avg != rows[j].Avg {
			return rows[i].Avg > rows[j].Avg
		}
		if rows[i].Pkg != rows[j].Pkg {
			return rows[i].Pkg < rows[j].Pkg
		}
		return rows[i].Test < rows[j].Test
	})
	return rows, dbs, nil
}

type profileAgg struct {
	cpu, mem   float64
	cpuN, memN int
}

func loadProfiles(dir string) (map[string]*profileAgg, error) {
	agg := map[string]*profileAgg{}
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".jsonl") {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 1024*1024), 1024*1024)
		for sc.Scan() {
			var r summaryRow
			if json.Unmarshal(sc.Bytes(), &r) != nil {
				continue
			}
			key := r.Pkg + "/" + r.Test
			if agg[key] == nil {
				agg[key] = &profileAgg{}
			}
			switch r.Metric {
			case "cpu":
				agg[key].cpu += float64(r.Value)
				agg[key].cpuN++
			case "mem":
				agg[key].mem += float64(r.Value)
				agg[key].memN++
			}
		}
		return sc.Err()
	})
	return agg, err
}

func writeCSV(path string, rows []testRow, dbs []string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	header := append([]string{"package", "test"}, dbs...)
	if err := w.Write(append(header, "average")); err != nil {
		return err
	}
	for _, r := range rows {
		rec := []string{r.Pkg, r.Test}
		for _, db := range dbs {
			if v, ok := r.DB[db]; ok {
				rec = append(rec, num(v))
			} else {
				rec = append(rec, "")
			}
		}
		if err := w.Write(append(rec, num(r.Avg))); err != nil {
			return err
		}
	}
	w.Flush()
	return w.Error()
}

func readTimingsCSV(path string) map[string]float64 {
	if path == "" {
		return nil
	}
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	recs, err := r.ReadAll()
	if err != nil || len(recs) < 2 {
		return nil
	}
	m := map[string]float64{}
	for _, rec := range recs[1:] {
		if len(rec) < 3 {
			continue
		}
		v, err := strconv.ParseFloat(rec[len(rec)-1], 64)
		if err != nil {
			continue
		}
		m[rec[0]+"/"+rec[1]] = v
	}
	return m
}

func loadOwners(path string, rows []testRow) map[string]string {
	owners := map[string]string{}
	data, err := os.ReadFile(path)
	if err != nil {
		data = nil
	}
	type rule struct{ prefix, owner string }
	var rules []rule
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 || !strings.HasPrefix(fields[0], "/") || strings.ContainsAny(fields[0], "*?") {
			continue
		}
		p := strings.Trim(fields[0], "/")
		rules = append(rules, rule{p, fields[1]})
	}
	for _, r := range rows {
		if _, ok := owners[r.Pkg]; ok {
			continue
		}
		best, owner := 0, "unknown"
		for _, rl := range rules {
			if strings.HasPrefix(r.Pkg+"/", rl.prefix+"/") && len(rl.prefix) > best {
				best, owner = len(rl.prefix), rl.owner
			}
		}
		owners[r.Pkg] = strings.TrimPrefix(owner, "@grafana/")
	}
	return owners
}

func badges(series, colors []string) string {
	var b []string
	for i, s := range series {
		b = append(b, fmt.Sprintf("![%s](https://img.shields.io/badge/%s-%s)", s, strings.ReplaceAll(s, "-", "--"), strings.TrimPrefix(colors[i], "#")))
	}
	return strings.Join(b, " ")
}

func xAxis(n int) string {
	var xs []string
	for i := 1; i <= n; i++ {
		xs = append(xs, fmt.Sprintf("%q", strconv.Itoa(i)))
	}
	return strings.Join(xs, ", ")
}

func bars(top []testRow, owners map[string]string, series []string, seriesIdx map[string]int) []string {
	var out []string
	for _, s := range series {
		vals := make([]string, len(top))
		for i, r := range top {
			o := owners[r.Pkg]
			if _, ok := seriesIdx[o]; !ok {
				o = "other"
			}
			if o == s {
				vals[i] = num(r.Avg)
			} else {
				vals[i] = "0"
			}
		}
		out = append(out, strings.Join(vals, ", "))
	}
	return out
}

func num(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func fmtdur(sec float64) string {
	if sec >= 60 {
		return fmt.Sprintf("%dm %ds", int(sec/60), int(math.Round(math.Mod(sec, 60))))
	}
	return fmt.Sprintf("%ds", int(math.Round(sec)))
}

func fmtdelta(d float64) string {
	r := math.Round(d*10) / 10
	if r > 0 {
		return "+" + num(r) + "s"
	}
	return num(r) + "s"
}

func fmtcpu(ns float64) string {
	return num(math.Round(ns/1e8)/10) + "s"
}

func fmtbytes(b float64) string {
	switch {
	case b >= 1<<30:
		return num(math.Round(b/(1<<30)*10)/10) + " GB"
	case b >= 1<<20:
		return num(math.Round(b/(1<<20)*10)/10) + " MB"
	default:
		return num(math.Round(b/(1<<10)*10)/10) + " KB"
	}
}
