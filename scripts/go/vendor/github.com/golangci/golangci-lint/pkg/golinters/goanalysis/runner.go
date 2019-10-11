// checker is a partial copy of https://github.com/golang/tools/blob/master/go/analysis/internal/checker
// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package checker defines the implementation of the checker commands.
// The same code drives the multi-analysis driver, the single-analysis
// driver that is conventionally provided for convenience along with
// each analysis package, and the test driver.
package goanalysis

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"go/ast"
	"go/parser"
	"go/scanner"
	"go/token"
	"go/types"
	"os"
	"reflect"
	"runtime"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/gcexportdata"
	"golang.org/x/tools/go/packages"
	"golang.org/x/tools/go/types/objectpath"

	"github.com/golangci/golangci-lint/internal/errorutil"
	"github.com/golangci/golangci-lint/internal/pkgcache"
	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis/load"
	"github.com/golangci/golangci-lint/pkg/logutils"
)

var (
	// Debug is a set of single-letter flags:
	//
	//	f	show [f]acts as they are created
	// 	p	disable [p]arallel execution of analyzers
	//	s	do additional [s]anity checks on fact types and serialization
	//	t	show [t]iming info (NB: use 'p' flag to avoid GC/scheduler noise)
	//	v	show [v]erbose logging
	//

	debugf             = logutils.Debug("goanalysis")
	factsDebugf        = logutils.Debug("goanalysis/facts")
	factsInheritDebugf = logutils.Debug("goanalysis/facts/inherit")
	factsExportDebugf  = logutils.Debug("goanalysis/facts")
	isFactsExportDebug = logutils.HaveDebugTag("goanalysis/facts/export")
	isMemoryDebug      = logutils.HaveDebugTag("goanalysis/memory")

	factsCacheDebugf = logutils.Debug("goanalysis/facts/cache")
	analyzeDebugf    = logutils.Debug("goanalysis/analyze")

	Debug = os.Getenv("GL_GOANALYSIS_DEBUG")

	unsafePkgName = "unsafe"
)

type Diagnostic struct {
	analysis.Diagnostic
	Analyzer *analysis.Analyzer
	Position token.Position
}

type runner struct {
	log       logutils.Log
	prefix    string // ensure unique analyzer names
	pkgCache  *pkgcache.Cache
	loadGuard *load.Guard
	loadMode  LoadMode
}

func newRunner(prefix string, logger logutils.Log, pkgCache *pkgcache.Cache, loadGuard *load.Guard, loadMode LoadMode) *runner {
	return &runner{
		prefix:    prefix,
		log:       logger,
		pkgCache:  pkgCache,
		loadGuard: loadGuard,
		loadMode:  loadMode,
	}
}

// Run loads the packages specified by args using go/packages,
// then applies the specified analyzers to them.
// Analysis flags must already have been set.
// It provides most of the logic for the main functions of both the
// singlechecker and the multi-analysis commands.
// It returns the appropriate exit code.
func (r *runner) run(analyzers []*analysis.Analyzer, initialPackages []*packages.Package) ([]Diagnostic, []error) {
	debugf("Analyzing %d packages on load mode %s", len(initialPackages), r.loadMode)
	defer r.pkgCache.Trim()

	roots := r.analyze(initialPackages, analyzers)
	return extractDiagnostics(roots)
}

type actKey struct {
	*analysis.Analyzer
	*packages.Package
}

func (r *runner) markAllActions(a *analysis.Analyzer, pkg *packages.Package, markedActions map[actKey]struct{}) {
	k := actKey{a, pkg}
	if _, ok := markedActions[k]; ok {
		return
	}

	for _, req := range a.Requires {
		r.markAllActions(req, pkg, markedActions)
	}

	if len(a.FactTypes) != 0 {
		for path := range pkg.Imports {
			r.markAllActions(a, pkg.Imports[path], markedActions)
		}
	}

	markedActions[k] = struct{}{}
}

func (r *runner) makeAction(a *analysis.Analyzer, pkg *packages.Package,
	initialPkgs map[*packages.Package]bool, actions map[actKey]*action, actAlloc *actionAllocator) *action {
	k := actKey{a, pkg}
	act, ok := actions[k]
	if ok {
		return act
	}

	act = actAlloc.alloc()
	act.a = a
	act.pkg = pkg
	act.log = r.log
	act.prefix = r.prefix
	act.pkgCache = r.pkgCache
	act.isInitialPkg = initialPkgs[pkg]
	act.needAnalyzeSource = initialPkgs[pkg]
	act.analysisDoneCh = make(chan struct{})

	depsCount := len(a.Requires)
	if len(a.FactTypes) > 0 {
		depsCount += len(pkg.Imports)
	}
	act.deps = make([]*action, 0, depsCount)

	// Add a dependency on each required analyzers.
	for _, req := range a.Requires {
		act.deps = append(act.deps, r.makeAction(req, pkg, initialPkgs, actions, actAlloc))
	}

	r.buildActionFactDeps(act, a, pkg, initialPkgs, actions, actAlloc)

	actions[k] = act
	return act
}

func (r *runner) buildActionFactDeps(act *action, a *analysis.Analyzer, pkg *packages.Package,
	initialPkgs map[*packages.Package]bool, actions map[actKey]*action, actAlloc *actionAllocator) {
	// An analysis that consumes/produces facts
	// must run on the package's dependencies too.
	if len(a.FactTypes) == 0 {
		return
	}

	act.objectFacts = make(map[objectFactKey]analysis.Fact)
	act.packageFacts = make(map[packageFactKey]analysis.Fact)

	paths := make([]string, 0, len(pkg.Imports))
	for path := range pkg.Imports {
		paths = append(paths, path)
	}
	sort.Strings(paths) // for determinism
	for _, path := range paths {
		dep := r.makeAction(a, pkg.Imports[path], initialPkgs, actions, actAlloc)
		act.deps = append(act.deps, dep)
	}

	// Need to register fact types for pkgcache proper gob encoding.
	for _, f := range a.FactTypes {
		gob.Register(f)
	}
}

type actionAllocator struct {
	allocatedActions []action
	nextFreeIndex    int
}

func newActionAllocator(maxCount int) *actionAllocator {
	return &actionAllocator{
		allocatedActions: make([]action, maxCount),
		nextFreeIndex:    0,
	}
}

func (actAlloc *actionAllocator) alloc() *action {
	if actAlloc.nextFreeIndex == len(actAlloc.allocatedActions) {
		panic(fmt.Sprintf("Made too many allocations of actions: %d allowed", len(actAlloc.allocatedActions)))
	}
	act := &actAlloc.allocatedActions[actAlloc.nextFreeIndex]
	actAlloc.nextFreeIndex++
	return act
}

//nolint:gocritic
func (r *runner) prepareAnalysis(pkgs []*packages.Package,
	analyzers []*analysis.Analyzer) (map[*packages.Package]bool, []*action, []*action) {
	// Construct the action graph.

	// Each graph node (action) is one unit of analysis.
	// Edges express package-to-package (vertical) dependencies,
	// and analysis-to-analysis (horizontal) dependencies.

	// This place is memory-intensive: e.g. Istio project has 120k total actions.
	// Therefore optimize it carefully.
	markedActions := make(map[actKey]struct{}, len(analyzers)*len(pkgs))
	for _, a := range analyzers {
		for _, pkg := range pkgs {
			r.markAllActions(a, pkg, markedActions)
		}
	}
	totalActionsCount := len(markedActions)

	actions := make(map[actKey]*action, totalActionsCount)
	actAlloc := newActionAllocator(totalActionsCount)

	initialPkgs := make(map[*packages.Package]bool, len(pkgs))
	for _, pkg := range pkgs {
		initialPkgs[pkg] = true
	}

	// Build nodes for initial packages.
	roots := make([]*action, 0, len(pkgs)*len(analyzers))
	for _, a := range analyzers {
		for _, pkg := range pkgs {
			root := r.makeAction(a, pkg, initialPkgs, actions, actAlloc)
			root.isroot = true
			roots = append(roots, root)
		}
	}

	allActions := make([]*action, 0, len(actions))
	for _, act := range actions {
		allActions = append(allActions, act)
	}

	debugf("Built %d actions", len(actions))

	return initialPkgs, allActions, roots
}

func (r *runner) analyze(pkgs []*packages.Package, analyzers []*analysis.Analyzer) []*action {
	initialPkgs, actions, rootActions := r.prepareAnalysis(pkgs, analyzers)

	actionPerPkg := map[*packages.Package][]*action{}
	for _, act := range actions {
		actionPerPkg[act.pkg] = append(actionPerPkg[act.pkg], act)
	}

	// Fill Imports field.
	loadingPackages := map[*packages.Package]*loadingPackage{}
	var dfs func(pkg *packages.Package)
	dfs = func(pkg *packages.Package) {
		if loadingPackages[pkg] != nil {
			return
		}

		imports := map[string]*loadingPackage{}
		for impPath, imp := range pkg.Imports {
			dfs(imp)
			impLp := loadingPackages[imp]
			impLp.dependents++
			imports[impPath] = impLp
		}

		loadingPackages[pkg] = &loadingPackage{
			pkg:        pkg,
			imports:    imports,
			isInitial:  initialPkgs[pkg],
			log:        r.log,
			actions:    actionPerPkg[pkg],
			loadGuard:  r.loadGuard,
			dependents: 1, // self dependent
		}
	}
	for _, act := range actions {
		dfs(act.pkg)
	}

	// Limit memory and IO usage.
	gomaxprocs := runtime.GOMAXPROCS(-1)
	debugf("Analyzing at most %d packages in parallel", gomaxprocs)
	loadSem := make(chan struct{}, gomaxprocs)

	var wg sync.WaitGroup
	debugf("There are %d initial and %d total packages", len(initialPkgs), len(loadingPackages))
	for _, lp := range loadingPackages {
		if lp.isInitial {
			wg.Add(1)
			go func(lp *loadingPackage) {
				lp.analyzeRecursive(r.loadMode, loadSem)
				wg.Done()
			}(lp)
		}
	}
	wg.Wait()

	return rootActions
}

//nolint:nakedret
func extractDiagnostics(roots []*action) (retDiags []Diagnostic, retErrors []error) {
	extracted := make(map[*action]bool)
	var extract func(*action)
	var visitAll func(actions []*action)
	visitAll = func(actions []*action) {
		for _, act := range actions {
			if !extracted[act] {
				extracted[act] = true
				visitAll(act.deps)
				extract(act)
			}
		}
	}

	// De-duplicate diagnostics by position (not token.Pos) to
	// avoid double-reporting in source files that belong to
	// multiple packages, such as foo and foo.test.
	type key struct {
		token.Position
		*analysis.Analyzer
		message string
	}
	seen := make(map[key]bool)

	extract = func(act *action) {
		if act.err != nil {
			if pe, ok := act.err.(*errorutil.PanicError); ok {
				panic(pe)
			}
			retErrors = append(retErrors, errors.Wrap(act.err, act.a.Name))
			return
		}

		if act.isroot {
			for _, diag := range act.diagnostics {
				// We don't display a.Name/f.Category
				// as most users don't care.

				posn := act.pkg.Fset.Position(diag.Pos)
				k := key{posn, act.a, diag.Message}
				if seen[k] {
					continue // duplicate
				}
				seen[k] = true

				retDiags = append(retDiags, Diagnostic{Diagnostic: diag, Analyzer: act.a, Position: posn})
			}
		}
	}
	visitAll(roots)
	return
}

// NeedFacts reports whether any analysis required by the specified set
// needs facts.  If so, we must load the entire program from source.
func NeedFacts(analyzers []*analysis.Analyzer) bool {
	seen := make(map[*analysis.Analyzer]bool)
	var q []*analysis.Analyzer // for BFS
	q = append(q, analyzers...)
	for len(q) > 0 {
		a := q[0]
		q = q[1:]
		if !seen[a] {
			seen[a] = true
			if len(a.FactTypes) > 0 {
				return true
			}
			q = append(q, a.Requires...)
		}
	}
	return false
}

// An action represents one unit of analysis work: the application of
// one analysis to one package. Actions form a DAG, both within a
// package (as different analyzers are applied, either in sequence or
// parallel), and across packages (as dependencies are analyzed).
type action struct {
	a                   *analysis.Analyzer
	pkg                 *packages.Package
	pass                *analysis.Pass
	deps                []*action
	objectFacts         map[objectFactKey]analysis.Fact
	packageFacts        map[packageFactKey]analysis.Fact
	result              interface{}
	diagnostics         []analysis.Diagnostic
	err                 error
	log                 logutils.Log
	prefix              string
	pkgCache            *pkgcache.Cache
	analysisDoneCh      chan struct{}
	loadCachedFactsDone bool
	loadCachedFactsOk   bool
	isroot              bool
	isInitialPkg        bool
	needAnalyzeSource   bool
}

type objectFactKey struct {
	obj types.Object
	typ reflect.Type
}

type packageFactKey struct {
	pkg *types.Package
	typ reflect.Type
}

func (act *action) String() string {
	return fmt.Sprintf("%s@%s", act.a, act.pkg)
}

func (act *action) loadCachedFacts() bool {
	if act.loadCachedFactsDone { // can't be set in parallel
		return act.loadCachedFactsOk
	}

	res := func() bool {
		if act.isInitialPkg {
			return true // load cached facts only for non-initial packages
		}

		if len(act.a.FactTypes) == 0 {
			return true // no need to load facts
		}

		return act.loadPersistedFacts()
	}()
	act.loadCachedFactsDone = true
	act.loadCachedFactsOk = res
	return res
}

func (act *action) waitUntilDependingAnalyzersWorked() {
	for _, dep := range act.deps {
		if dep.pkg == act.pkg {
			<-dep.analysisDoneCh
		}
	}
}

type IllTypedError struct {
	Pkg *packages.Package
}

func (e *IllTypedError) Error() string {
	return fmt.Sprintf("errors in package: %v", e.Pkg.Errors)
}

func (act *action) analyzeSafe() {
	defer func() {
		if p := recover(); p != nil {
			act.err = errorutil.NewPanicError(fmt.Sprintf("%s: package %q (isInitialPkg: %t, needAnalyzeSource: %t): %s",
				act.a.Name, act.pkg.Name, act.isInitialPkg, act.needAnalyzeSource, p), debug.Stack())
		}
	}()
	act.analyze()
}

func (act *action) analyze() {
	defer close(act.analysisDoneCh) // unblock actions depending on this action

	if !act.needAnalyzeSource {
		return
	}

	// TODO(adonovan): uncomment this during profiling.
	// It won't build pre-go1.11 but conditional compilation
	// using build tags isn't warranted.
	//
	// ctx, task := trace.NewTask(context.Background(), "exec")
	// trace.Log(ctx, "pass", act.String())
	// defer task.End()

	// Record time spent in this node but not its dependencies.
	// In parallel mode, due to GC/scheduler contention, the
	// time is 5x higher than in sequential mode, even with a
	// semaphore limiting the number of threads here.
	// So use -debug=tp.

	defer func(now time.Time) {
		analyzeDebugf("go/analysis: %s: %s: analyzed package %q in %s", act.prefix, act.a.Name, act.pkg.Name, time.Since(now))
	}(time.Now())

	// Report an error if any dependency failed.
	var failed []string
	for _, dep := range act.deps {
		if dep.err != nil {
			failed = append(failed, dep.String())
		}
	}
	if failed != nil {
		sort.Strings(failed)
		act.err = fmt.Errorf("failed prerequisites: %s", strings.Join(failed, ", "))
		return
	}

	// Plumb the output values of the dependencies
	// into the inputs of this action.  Also facts.
	inputs := make(map[*analysis.Analyzer]interface{})
	startedAt := time.Now()
	for _, dep := range act.deps {
		if dep.pkg == act.pkg {
			// Same package, different analysis (horizontal edge):
			// in-memory outputs of prerequisite analyzers
			// become inputs to this analysis pass.
			inputs[dep.a] = dep.result
		} else if dep.a == act.a { // (always true)
			// Same analysis, different package (vertical edge):
			// serialized facts produced by prerequisite analysis
			// become available to this analysis pass.
			inheritFacts(act, dep)
		}
	}
	factsDebugf("%s: Inherited facts in %s", act, time.Since(startedAt))

	// Run the analysis.
	pass := &analysis.Pass{
		Analyzer:          act.a,
		Fset:              act.pkg.Fset,
		Files:             act.pkg.Syntax,
		OtherFiles:        act.pkg.OtherFiles,
		Pkg:               act.pkg.Types,
		TypesInfo:         act.pkg.TypesInfo,
		TypesSizes:        act.pkg.TypesSizes,
		ResultOf:          inputs,
		Report:            func(d analysis.Diagnostic) { act.diagnostics = append(act.diagnostics, d) },
		ImportObjectFact:  act.importObjectFact,
		ExportObjectFact:  act.exportObjectFact,
		ImportPackageFact: act.importPackageFact,
		ExportPackageFact: act.exportPackageFact,
		AllObjectFacts:    act.allObjectFacts,
		AllPackageFacts:   act.allPackageFacts,
	}
	act.pass = pass

	var err error
	if act.pkg.IllTyped {
		// It looks like there should be !pass.Analyzer.RunDespiteErrors
		// but govet's cgocall crashes on it. Govet itself contains !pass.Analyzer.RunDespiteErrors condition here
		// but it exit before it if packages.Load have failed.
		err = errors.Wrap(&IllTypedError{Pkg: act.pkg}, "analysis skipped")
	} else {
		startedAt = time.Now()
		act.result, err = pass.Analyzer.Run(pass)
		analyzedIn := time.Since(startedAt)
		if analyzedIn > time.Millisecond*10 {
			debugf("%s: run analyzer in %s", act, analyzedIn)
		}
	}
	act.err = err

	// disallow calls after Run
	pass.ExportObjectFact = nil
	pass.ExportPackageFact = nil

	if err := act.persistFactsToCache(); err != nil {
		act.log.Warnf("Failed to persist facts to cache: %s", err)
	}
}

// inheritFacts populates act.facts with
// those it obtains from its dependency, dep.
func inheritFacts(act, dep *action) {
	serialize := false

	for key, fact := range dep.objectFacts {
		// Filter out facts related to objects
		// that are irrelevant downstream
		// (equivalently: not in the compiler export data).
		if !exportedFrom(key.obj, dep.pkg.Types) {
			factsInheritDebugf("%v: discarding %T fact from %s for %s: %s", act, fact, dep, key.obj, fact)
			continue
		}

		// Optionally serialize/deserialize fact
		// to verify that it works across address spaces.
		if serialize {
			var err error
			fact, err = codeFact(fact)
			if err != nil {
				act.log.Panicf("internal error: encoding of %T fact failed in %v", fact, act)
			}
		}

		factsInheritDebugf("%v: inherited %T fact for %s: %s", act, fact, key.obj, fact)
		act.objectFacts[key] = fact
	}

	for key, fact := range dep.packageFacts {
		// TODO: filter out facts that belong to
		// packages not mentioned in the export data
		// to prevent side channels.

		// Optionally serialize/deserialize fact
		// to verify that it works across address spaces
		// and is deterministic.
		if serialize {
			var err error
			fact, err = codeFact(fact)
			if err != nil {
				act.log.Panicf("internal error: encoding of %T fact failed in %v", fact, act)
			}
		}

		factsInheritDebugf("%v: inherited %T fact for %s: %s", act, fact, key.pkg.Path(), fact)
		act.packageFacts[key] = fact
	}
}

// codeFact encodes then decodes a fact,
// just to exercise that logic.
func codeFact(fact analysis.Fact) (analysis.Fact, error) {
	// We encode facts one at a time.
	// A real modular driver would emit all facts
	// into one encoder to improve gob efficiency.
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(fact); err != nil {
		return nil, err
	}

	// Encode it twice and assert that we get the same bits.
	// This helps detect nondeterministic Gob encoding (e.g. of maps).
	var buf2 bytes.Buffer
	if err := gob.NewEncoder(&buf2).Encode(fact); err != nil {
		return nil, err
	}
	if !bytes.Equal(buf.Bytes(), buf2.Bytes()) {
		return nil, fmt.Errorf("encoding of %T fact is nondeterministic", fact)
	}

	newFact := reflect.New(reflect.TypeOf(fact).Elem()).Interface().(analysis.Fact)
	if err := gob.NewDecoder(&buf).Decode(newFact); err != nil {
		return nil, err
	}
	return newFact, nil
}

// exportedFrom reports whether obj may be visible to a package that imports pkg.
// This includes not just the exported members of pkg, but also unexported
// constants, types, fields, and methods, perhaps belonging to oether packages,
// that find there way into the API.
// This is an overapproximation of the more accurate approach used by
// gc export data, which walks the type graph, but it's much simpler.
//
// TODO(adonovan): do more accurate filtering by walking the type graph.
func exportedFrom(obj types.Object, pkg *types.Package) bool {
	switch obj := obj.(type) {
	case *types.Func:
		return obj.Exported() && obj.Pkg() == pkg ||
			obj.Type().(*types.Signature).Recv() != nil
	case *types.Var:
		return obj.Exported() && obj.Pkg() == pkg ||
			obj.IsField()
	case *types.TypeName, *types.Const:
		return true
	}
	return false // Nil, Builtin, Label, or PkgName
}

// importObjectFact implements Pass.ImportObjectFact.
// Given a non-nil pointer ptr of type *T, where *T satisfies Fact,
// importObjectFact copies the fact value to *ptr.
func (act *action) importObjectFact(obj types.Object, ptr analysis.Fact) bool {
	if obj == nil {
		panic("nil object")
	}
	key := objectFactKey{obj, act.factType(ptr)}
	if v, ok := act.objectFacts[key]; ok {
		reflect.ValueOf(ptr).Elem().Set(reflect.ValueOf(v).Elem())
		return true
	}
	return false
}

// exportObjectFact implements Pass.ExportObjectFact.
func (act *action) exportObjectFact(obj types.Object, fact analysis.Fact) {
	if obj.Pkg() != act.pkg.Types {
		act.log.Panicf("internal error: in analysis %s of package %s: Fact.Set(%s, %T): can't set facts on objects belonging another package",
			act.a, act.pkg, obj, fact)
	}

	key := objectFactKey{obj, act.factType(fact)}
	act.objectFacts[key] = fact // clobber any existing entry
	if isFactsExportDebug {
		objstr := types.ObjectString(obj, (*types.Package).Name)
		factsExportDebugf("%s: object %s has fact %s\n",
			act.pkg.Fset.Position(obj.Pos()), objstr, fact)
	}
}

func (act *action) allObjectFacts() []analysis.ObjectFact {
	out := make([]analysis.ObjectFact, 0, len(act.objectFacts))
	for key, fact := range act.objectFacts {
		out = append(out, analysis.ObjectFact{
			Object: key.obj,
			Fact:   fact,
		})
	}
	return out
}

// importPackageFact implements Pass.ImportPackageFact.
// Given a non-nil pointer ptr of type *T, where *T satisfies Fact,
// fact copies the fact value to *ptr.
func (act *action) importPackageFact(pkg *types.Package, ptr analysis.Fact) bool {
	if pkg == nil {
		panic("nil package")
	}
	key := packageFactKey{pkg, act.factType(ptr)}
	if v, ok := act.packageFacts[key]; ok {
		reflect.ValueOf(ptr).Elem().Set(reflect.ValueOf(v).Elem())
		return true
	}
	return false
}

// exportPackageFact implements Pass.ExportPackageFact.
func (act *action) exportPackageFact(fact analysis.Fact) {
	key := packageFactKey{act.pass.Pkg, act.factType(fact)}
	act.packageFacts[key] = fact // clobber any existing entry
	factsDebugf("%s: package %s has fact %s\n",
		act.pkg.Fset.Position(act.pass.Files[0].Pos()), act.pass.Pkg.Path(), fact)
}

func (act *action) allPackageFacts() []analysis.PackageFact {
	out := make([]analysis.PackageFact, 0, len(act.packageFacts))
	for key, fact := range act.packageFacts {
		out = append(out, analysis.PackageFact{
			Package: key.pkg,
			Fact:    fact,
		})
	}
	return out
}

func (act *action) factType(fact analysis.Fact) reflect.Type {
	t := reflect.TypeOf(fact)
	if t.Kind() != reflect.Ptr {
		act.log.Fatalf("invalid Fact type: got %T, want pointer", t)
	}
	return t
}

type Fact struct {
	Path string // non-empty only for object facts
	Fact analysis.Fact
}

func (act *action) persistFactsToCache() error {
	analyzer := act.a
	if len(analyzer.FactTypes) == 0 {
		return nil
	}

	// Merge new facts into the package and persist them.
	var facts []Fact
	for key, fact := range act.packageFacts {
		if key.pkg != act.pkg.Types {
			// The fact is from inherited facts from another package
			continue
		}
		facts = append(facts, Fact{
			Path: "",
			Fact: fact,
		})
	}
	for key, fact := range act.objectFacts {
		obj := key.obj
		if obj.Pkg() != act.pkg.Types {
			// The fact is from inherited facts from another package
			continue
		}

		path, err := objectpath.For(obj)
		if err != nil {
			// The object is not globally addressable
			continue
		}

		facts = append(facts, Fact{
			Path: string(path),
			Fact: fact,
		})
	}

	factsCacheDebugf("Caching %d facts for package %q and analyzer %s", len(facts), act.pkg.Name, act.a.Name)

	key := fmt.Sprintf("%s/facts", analyzer.Name)
	return act.pkgCache.Put(act.pkg, key, facts)
}

func (act *action) loadPersistedFacts() bool {
	var facts []Fact
	key := fmt.Sprintf("%s/facts", act.a.Name)
	if err := act.pkgCache.Get(act.pkg, key, &facts); err != nil {
		if err != pkgcache.ErrMissing {
			act.log.Warnf("Failed to get persisted facts: %s", err)
		}

		factsCacheDebugf("No cached facts for package %q and analyzer %s", act.pkg.Name, act.a.Name)
		return false
	}

	factsCacheDebugf("Loaded %d cached facts for package %q and analyzer %s", len(facts), act.pkg.Name, act.a.Name)

	for _, f := range facts {
		if f.Path == "" { // this is a package fact
			key := packageFactKey{act.pkg.Types, act.factType(f.Fact)}
			act.packageFacts[key] = f.Fact
			continue
		}
		obj, err := objectpath.Object(act.pkg.Types, objectpath.Path(f.Path))
		if err != nil {
			// Be lenient about these errors. For example, when
			// analyzing io/ioutil from source, we may get a fact
			// for methods on the devNull type, and objectpath
			// will happily create a path for them. However, when
			// we later load io/ioutil from export data, the path
			// no longer resolves.
			//
			// If an exported type embeds the unexported type,
			// then (part of) the unexported type will become part
			// of the type information and our path will resolve
			// again.
			continue
		}
		factKey := objectFactKey{obj, act.factType(f.Fact)}
		act.objectFacts[factKey] = f.Fact
	}

	return true
}

type loadingPackage struct {
	pkg         *packages.Package
	imports     map[string]*loadingPackage
	isInitial   bool
	log         logutils.Log
	actions     []*action // all actions with this package
	loadGuard   *load.Guard
	dependents  int32 // number of depending on it packages
	analyzeOnce sync.Once
	decUseMutex sync.Mutex
}

func (lp *loadingPackage) String() string {
	return fmt.Sprintf("%s@%s", lp.pkg.PkgPath, lp.pkg.Name)
}

func sizeOfValueTreeBytes(v interface{}) int {
	return sizeOfReflectValueTreeBytes(reflect.ValueOf(v), map[uintptr]struct{}{})
}

func sizeOfReflectValueTreeBytes(rv reflect.Value, visitedPtrs map[uintptr]struct{}) int {
	switch rv.Kind() {
	case reflect.Ptr:
		ptrSize := int(rv.Type().Size())
		if rv.IsNil() {
			return ptrSize
		}
		ptr := rv.Pointer()
		if _, ok := visitedPtrs[ptr]; ok {
			return 0
		}
		visitedPtrs[ptr] = struct{}{}
		return ptrSize + sizeOfReflectValueTreeBytes(rv.Elem(), visitedPtrs)
	case reflect.Interface:
		if rv.IsNil() {
			return 0
		}
		return sizeOfReflectValueTreeBytes(rv.Elem(), visitedPtrs)
	case reflect.Struct:
		ret := 0
		for i := 0; i < rv.NumField(); i++ {
			ret += sizeOfReflectValueTreeBytes(rv.Field(i), visitedPtrs)
		}
		return ret
	case reflect.Slice, reflect.Array, reflect.Chan:
		return int(rv.Type().Size()) + rv.Cap()*int(rv.Type().Elem().Size())
	case reflect.Map:
		ret := 0
		for _, key := range rv.MapKeys() {
			mv := rv.MapIndex(key)
			ret += sizeOfReflectValueTreeBytes(key, visitedPtrs)
			ret += sizeOfReflectValueTreeBytes(mv, visitedPtrs)
		}
		return ret
	case reflect.String:
		return rv.Len()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Uintptr, reflect.Bool, reflect.Float32, reflect.Float64, reflect.UnsafePointer:
		return int(rv.Type().Size())
	case reflect.Invalid:
		return 0
	default:
		panic("unknown rv of type " + fmt.Sprint(rv))
	}
}

func (lp *loadingPackage) decUse() {
	lp.decUseMutex.Lock()
	defer lp.decUseMutex.Unlock()

	for _, act := range lp.actions {
		pass := act.pass
		if pass == nil {
			continue
		}

		pass.Files = nil
		pass.TypesInfo = nil
		pass.TypesSizes = nil
		pass.ResultOf = nil
		pass.Pkg = nil
		pass.OtherFiles = nil
		pass.AllObjectFacts = nil
		pass.AllPackageFacts = nil
		pass.ImportObjectFact = nil
		pass.ExportObjectFact = nil
		pass.ImportPackageFact = nil
		pass.ExportPackageFact = nil
		act.pass = nil
		act.deps = nil
		if act.result != nil {
			if isMemoryDebug {
				debugf("%s: decUse: nilling act result of size %d bytes", act, sizeOfValueTreeBytes(act.result))
			}
			act.result = nil
		}
	}

	lp.pkg.Syntax = nil
	lp.pkg.TypesInfo = nil
	lp.pkg.TypesSizes = nil

	// Can't set lp.pkg.Imports to nil because of loadFromExportData.visit.

	dependents := atomic.AddInt32(&lp.dependents, -1)
	if dependents != 0 {
		return
	}

	lp.pkg.Types = nil
	lp.pkg = nil

	for _, imp := range lp.imports {
		imp.decUse()
	}
	lp.imports = nil

	for _, act := range lp.actions {
		if !lp.isInitial {
			act.pkg = nil
		}
		act.packageFacts = nil
		act.objectFacts = nil
	}
	lp.actions = nil
}

func (lp *loadingPackage) analyzeRecursive(loadMode LoadMode, loadSem chan struct{}) {
	lp.analyzeOnce.Do(func() {
		// Load the direct dependencies, in parallel.
		var wg sync.WaitGroup
		wg.Add(len(lp.imports))
		for _, imp := range lp.imports {
			go func(imp *loadingPackage) {
				imp.analyzeRecursive(loadMode, loadSem)
				wg.Done()
			}(imp)
		}
		wg.Wait()
		lp.analyze(loadMode, loadSem)
	})
}

func (lp *loadingPackage) analyze(loadMode LoadMode, loadSem chan struct{}) {
	loadSem <- struct{}{}
	defer func() {
		<-loadSem
	}()

	defer func() {
		if loadMode < LoadModeWholeProgram {
			// Save memory on unused more fields.
			lp.decUse()
		}
	}()

	if err := lp.loadWithFacts(loadMode); err != nil {
		werr := errors.Wrapf(err, "failed to load package %s", lp.pkg.Name)
		// Don't need to write error to errCh, it will be extracted and reported on another layer.
		// Unblock depending actions and propagate error.
		for _, act := range lp.actions {
			close(act.analysisDoneCh)
			act.err = werr
		}
		return
	}

	var actsWg sync.WaitGroup
	actsWg.Add(len(lp.actions))
	for _, act := range lp.actions {
		go func(act *action) {
			defer actsWg.Done()

			act.waitUntilDependingAnalyzersWorked()

			act.analyzeSafe()
		}(act)
	}
	actsWg.Wait()
}

func (lp *loadingPackage) loadFromSource(loadMode LoadMode) error {
	pkg := lp.pkg

	// Many packages have few files, much fewer than there
	// are CPU cores. Additionally, parsing each individual file is
	// very fast. A naive parallel implementation of this loop won't
	// be faster, and tends to be slower due to extra scheduling,
	// bookkeeping and potentially false sharing of cache lines.
	pkg.Syntax = make([]*ast.File, 0, len(pkg.CompiledGoFiles))
	for _, file := range pkg.CompiledGoFiles {
		f, err := parser.ParseFile(pkg.Fset, file, nil, parser.ParseComments)
		if err != nil {
			pkg.Errors = append(pkg.Errors, lp.convertError(err)...)
			continue
		}
		pkg.Syntax = append(pkg.Syntax, f)
	}
	if len(pkg.Errors) != 0 {
		pkg.IllTyped = true
		return nil
	}

	if loadMode == LoadModeSyntax {
		return nil
	}

	// Call NewPackage directly with explicit name.
	// This avoids skew between golist and go/types when the files'
	// package declarations are inconsistent.
	// Subtle: we populate all Types fields with an empty Package
	// before loading export data so that export data processing
	// never has to create a types.Package for an indirect dependency,
	// which would then require that such created packages be explicitly
	// inserted back into the Import graph as a final step after export data loading.
	pkg.Types = types.NewPackage(pkg.PkgPath, pkg.Name)

	pkg.IllTyped = true

	pkg.TypesInfo = &types.Info{
		Types:      make(map[ast.Expr]types.TypeAndValue),
		Defs:       make(map[*ast.Ident]types.Object),
		Uses:       make(map[*ast.Ident]types.Object),
		Implicits:  make(map[ast.Node]types.Object),
		Scopes:     make(map[ast.Node]*types.Scope),
		Selections: make(map[*ast.SelectorExpr]*types.Selection),
	}

	importer := func(path string) (*types.Package, error) {
		if path == unsafePkgName {
			return types.Unsafe, nil
		}
		if path == "C" {
			// go/packages doesn't tell us that cgo preprocessing
			// failed. When we subsequently try to parse the package,
			// we'll encounter the raw C import.
			return nil, errors.New("cgo preprocessing failed")
		}
		imp := pkg.Imports[path]
		if imp == nil {
			return nil, nil
		}
		if len(imp.Errors) > 0 {
			return nil, imp.Errors[0]
		}
		return imp.Types, nil
	}
	tc := &types.Config{
		Importer: importerFunc(importer),
		Error: func(err error) {
			pkg.Errors = append(pkg.Errors, lp.convertError(err)...)
		},
	}
	_ = types.NewChecker(tc, pkg.Fset, pkg.Types, pkg.TypesInfo).Files(pkg.Syntax)
	// Don't handle error here: errors are adding by tc.Error function.

	illTyped := len(pkg.Errors) != 0
	if !illTyped {
		for _, imp := range lp.imports {
			if imp.pkg.IllTyped {
				illTyped = true
				break
			}
		}
	}
	pkg.IllTyped = illTyped
	return nil
}

func (lp *loadingPackage) loadFromExportData() error {
	// Because gcexportdata.Read has the potential to create or
	// modify the types.Package for each node in the transitive
	// closure of dependencies of lpkg, all exportdata operations
	// must be sequential. (Finer-grained locking would require
	// changes to the gcexportdata API.)
	//
	// The exportMu lock guards the Package.Pkg field and the
	// types.Package it points to, for each Package in the graph.
	//
	// Not all accesses to Package.Pkg need to be protected by this mutex:
	// graph ordering ensures that direct dependencies of source
	// packages are fully loaded before the importer reads their Pkg field.
	mu := lp.loadGuard.MutexForExportData()
	mu.Lock()
	defer mu.Unlock()

	pkg := lp.pkg

	// Call NewPackage directly with explicit name.
	// This avoids skew between golist and go/types when the files'
	// package declarations are inconsistent.
	// Subtle: we populate all Types fields with an empty Package
	// before loading export data so that export data processing
	// never has to create a types.Package for an indirect dependency,
	// which would then require that such created packages be explicitly
	// inserted back into the Import graph as a final step after export data loading.
	pkg.Types = types.NewPackage(pkg.PkgPath, pkg.Name)

	pkg.IllTyped = true
	for path, pkg := range pkg.Imports {
		if pkg.Types == nil {
			return fmt.Errorf("dependency %q hasn't been loaded yet", path)
		}
	}
	if pkg.ExportFile == "" {
		return fmt.Errorf("no export data for %q", pkg.ID)
	}
	f, err := os.Open(pkg.ExportFile)
	if err != nil {
		return err
	}
	defer f.Close()

	r, err := gcexportdata.NewReader(f)
	if err != nil {
		return err
	}

	view := make(map[string]*types.Package)  // view seen by gcexportdata
	seen := make(map[*packages.Package]bool) // all visited packages
	var visit func(pkgs map[string]*packages.Package)
	visit = func(pkgs map[string]*packages.Package) {
		for _, pkg := range pkgs {
			if !seen[pkg] {
				seen[pkg] = true
				view[pkg.PkgPath] = pkg.Types
				visit(pkg.Imports)
			}
		}
	}
	visit(pkg.Imports)
	tpkg, err := gcexportdata.Read(r, pkg.Fset, view, pkg.PkgPath)
	if err != nil {
		return err
	}
	pkg.Types = tpkg
	pkg.IllTyped = false
	return nil
}

func (act *action) markDepsForAnalyzingSource() {
	// Horizontal deps (analyzer.Requires) must be loaded from source and analyzed before analyzing
	// this action.
	for _, dep := range act.deps {
		if dep.pkg == act.pkg {
			// Analyze source only for horizontal dependencies, e.g. from "buildssa".
			dep.needAnalyzeSource = true // can't be set in parallel
		}
	}
}

func (lp *loadingPackage) loadWithFacts(loadMode LoadMode) error {
	pkg := lp.pkg

	if pkg.PkgPath == unsafePkgName {
		// Fill in the blanks to avoid surprises.
		pkg.Syntax = []*ast.File{}
		if loadMode >= LoadModeTypesInfo {
			pkg.Types = types.Unsafe
			pkg.TypesInfo = new(types.Info)
		}
		return nil
	}

	if pkg.TypesInfo != nil {
		// Already loaded package, e.g. because another not go/analysis linter required types for deps.
		// Try load cached facts for it.

		for _, act := range lp.actions {
			if !act.loadCachedFacts() {
				// Cached facts loading failed: analyze later the action from source.
				act.needAnalyzeSource = true
				factsCacheDebugf("Loading of facts for already loaded %s failed, analyze it from source later", act)
				act.markDepsForAnalyzingSource()
			}
		}
		return nil
	}

	if lp.isInitial {
		// No need to load cached facts: the package will be analyzed from source
		// because it's the initial.
		return lp.loadFromSource(loadMode)
	}

	return lp.loadImportedPackageWithFacts(loadMode)
}

func (lp *loadingPackage) loadImportedPackageWithFacts(loadMode LoadMode) error {
	pkg := lp.pkg

	// Load package from export data
	if loadMode >= LoadModeTypesInfo {
		if err := lp.loadFromExportData(); err != nil {
			// We asked Go to give us up to date export data, yet
			// we can't load it. There must be something wrong.
			//
			// Attempt loading from source. This should fail (because
			// otherwise there would be export data); we just want to
			// get the compile errors. If loading from source succeeds
			// we discard the result, anyway. Otherwise we'll fail
			// when trying to reload from export data later.

			// Otherwise it panics because uses already existing (from exported data) types.
			pkg.Types = types.NewPackage(pkg.PkgPath, pkg.Name)
			if srcErr := lp.loadFromSource(loadMode); srcErr != nil {
				return srcErr
			}
			// Make sure this package can't be imported successfully
			pkg.Errors = append(pkg.Errors, packages.Error{
				Pos:  "-",
				Msg:  fmt.Sprintf("could not load export data: %s", err),
				Kind: packages.ParseError,
			})
			return errors.Wrap(err, "could not load export data")
		}
	}

	needLoadFromSource := false
	for _, act := range lp.actions {
		if act.loadCachedFacts() {
			continue
		}

		// Cached facts loading failed: analyze later the action from source.
		factsCacheDebugf("Loading of facts for %s failed, analyze it from source later", act)
		act.needAnalyzeSource = true // can't be set in parallel
		needLoadFromSource = true

		act.markDepsForAnalyzingSource()
	}

	if needLoadFromSource {
		// Cached facts loading failed: analyze later the action from source. To perform
		// the analysis we need to load the package from source code.

		// Otherwise it panics because uses already existing (from exported data) types.
		if loadMode >= LoadModeTypesInfo {
			pkg.Types = types.NewPackage(pkg.PkgPath, pkg.Name)
		}
		return lp.loadFromSource(loadMode)
	}

	return nil
}

func (lp *loadingPackage) convertError(err error) []packages.Error {
	var errs []packages.Error
	// taken from go/packages
	switch err := err.(type) {
	case packages.Error:
		// from driver
		errs = append(errs, err)

	case *os.PathError:
		// from parser
		errs = append(errs, packages.Error{
			Pos:  err.Path + ":1",
			Msg:  err.Err.Error(),
			Kind: packages.ParseError,
		})

	case scanner.ErrorList:
		// from parser
		for _, err := range err {
			errs = append(errs, packages.Error{
				Pos:  err.Pos.String(),
				Msg:  err.Msg,
				Kind: packages.ParseError,
			})
		}

	case types.Error:
		// from type checker
		errs = append(errs, packages.Error{
			Pos:  err.Fset.Position(err.Pos).String(),
			Msg:  err.Msg,
			Kind: packages.TypeError,
		})

	default:
		// unexpected impoverished error from parser?
		errs = append(errs, packages.Error{
			Pos:  "-",
			Msg:  err.Error(),
			Kind: packages.UnknownError,
		})

		// If you see this error message, please file a bug.
		lp.log.Warnf("Internal error: error %q (%T) without position", err, err)
	}
	return errs
}

type importerFunc func(path string) (*types.Package, error)

func (f importerFunc) Import(path string) (*types.Package, error) { return f(path) }
