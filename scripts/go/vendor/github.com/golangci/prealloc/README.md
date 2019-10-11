# prealloc

prealloc is a Go static analysis tool to find slice declarations that could potentially be preallocated.

## Installation

    go get -u github.com/alexkohler/prealloc

## Usage

Similar to other Go static analysis tools (such as golint, go vet), prealloc can be invoked with one or more filenames, directories, or packages named by its import path. Prealloc also supports the `...` wildcard.

    prealloc [flags] files/directories/packages

### Flags
- **-simple** (default true) - Report preallocation suggestions only on simple loops that have no returns/breaks/continues/gotos in them. Setting this to false may increase false positives.
- **-rangeloops** (default true) - Report preallocation suggestions on range loops.
- **-forloops** (default false) - Report preallocation suggestions on for loops. This is false by default due to there generally being weirder things happening inside for loops (at least from what I've observed in the Standard Library).
- **-set_exit_status** (default false) - Set exit status to 1 if any issues are found.

## Purpose

While the [Go *does* attempt to avoid reallocation by growing the capacity in advance](https://github.com/golang/go/blob/87e48c5afdcf5e01bb2b7f51b7643e8901f4b7f9/src/runtime/slice.go#L100-L112), this sometimes isn't enough for longer slices.  If the size of a slice is known at the time of its creation, it should be specified.

Consider the following benchmark: (this can be found in prealloc_test.go in this repo)

```Go
import "testing"

func BenchmarkNoPreallocate(b *testing.B) {
	existing := make([]int64, 10, 10)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Don't preallocate our initial slice
		var init []int64
		for _, element := range existing {
			init = append(init, element)
		}
	}
}

func BenchmarkPreallocate(b *testing.B) {
	existing := make([]int64, 10, 10)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Preallocate our initial slice
		init := make([]int64, 0, len(existing))
		for _, element := range existing {
			init = append(init, element)
		}
	}
}
```

```Bash
$ go test -bench=. -benchmem
goos: linux
goarch: amd64
BenchmarkNoPreallocate-4   	 3000000	       510 ns/op	     248 B/op	       5 allocs/op
BenchmarkPreallocate-4     	20000000	       111 ns/op	      80 B/op	       1 allocs/op
```

As you can see, not preallocating can cause a performance hit, primarily due to Go having to reallocate the underlying array. The pattern benchmarked above is common in Go: declare a slice, then write some sort of range or for loop that appends or indexes into it. The purpose of this tool is to flag slice/loop declarations like the one in `BenchmarkNoPreallocate`. 

## Example

Some examples from the Go 1.9.2 source:

```Bash
$ prealloc go/src/....
archive/tar/reader_test.go:854 Consider preallocating ss
archive/zip/zip_test.go:201 Consider preallocating all
cmd/api/goapi.go:301 Consider preallocating missing
cmd/api/goapi.go:476 Consider preallocating files
cmd/asm/internal/asm/endtoend_test.go:345 Consider preallocating extra
cmd/cgo/main.go:60 Consider preallocating ks
cmd/cgo/ast.go:149 Consider preallocating pieces
cmd/compile/internal/ssa/flagalloc.go:64 Consider preallocating oldSched
cmd/compile/internal/ssa/regalloc.go:719 Consider preallocating phis
cmd/compile/internal/ssa/regalloc.go:718 Consider preallocating oldSched
cmd/compile/internal/ssa/regalloc.go:1674 Consider preallocating oldSched
cmd/compile/internal/ssa/gen/rulegen.go:145 Consider preallocating ops
cmd/compile/internal/ssa/gen/rulegen.go:145 Consider preallocating ops
cmd/dist/build.go:893 Consider preallocating all
cmd/dist/build.go:1246 Consider preallocating plats
cmd/dist/build.go:1264 Consider preallocating results
cmd/dist/buildgo.go:59 Consider preallocating list
cmd/doc/pkg.go:363 Consider preallocating names
cmd/fix/typecheck.go:219 Consider preallocating b
cmd/go/internal/base/path.go:34 Consider preallocating out
cmd/go/internal/get/get.go:175 Consider preallocating out
cmd/go/internal/load/pkg.go:1894 Consider preallocating dirent
cmd/go/internal/work/build.go:2402 Consider preallocating absOfiles
cmd/go/internal/work/build.go:2731 Consider preallocating absOfiles
cmd/internal/objfile/pe.go:48 Consider preallocating syms
cmd/internal/objfile/pe.go:38 Consider preallocating addrs
cmd/internal/objfile/goobj.go:43 Consider preallocating syms
cmd/internal/objfile/elf.go:35 Consider preallocating syms
cmd/link/internal/ld/lib.go:1070 Consider preallocating argv
cmd/vet/all/main.go:91 Consider preallocating pp
database/sql/sql.go:66 Consider preallocating list
debug/macho/file.go:506 Consider preallocating all
internal/trace/order.go:55 Consider preallocating batches
mime/quotedprintable/reader_test.go:191 Consider preallocating outcomes
net/dnsclient_unix_test.go:954 Consider preallocating confLines
net/interface_solaris.go:85 Consider preallocating ifat
net/interface_linux_test.go:91 Consider preallocating ifmat4
net/interface_linux_test.go:100 Consider preallocating ifmat6
net/internal/socktest/switch.go:34 Consider preallocating st
os/os_windows_test.go:766 Consider preallocating args
runtime/pprof/internal/profile/filter.go:77 Consider preallocating lines
runtime/pprof/internal/profile/profile.go:554 Consider preallocating names
text/template/parse/node.go:189 Consider preallocating decl
```

```Go
// cmd/api/goapi.go:301
var missing []string
for feature := range optionalSet {
	missing = append(missing, feature)
}

// cmd/fix/typecheck.go:219
var b []ast.Expr
for _, x := range a {
	b = append(b, x)
}

// net/internal/socktest/switch.go:34
var st []Stat
sw.smu.RLock()
for _, s := range sw.stats {
	ns := *s
	st = append(st, ns)
}
sw.smu.RUnlock()

// cmd/api/goapi.go:301
var missing []string
for feature := range optionalSet {
	missing = append(missing, feature)
}
```

Even if the size the slice is being preallocated to is small, there's still a performance gain to be had in explicitly specifying the capacity rather than leaving it up to `append` to discover that it needs to preallocate. Of course, preallocation doesn't need to be done *everywhere*. This tool's job is just to help suggest places where one should consider preallocating.

## How do I fix prealloc's suggestions?

During the declaration of your slice, rather than using the zero value of the slice with `var`, initialize it with Go's built-in `make` function, passing the appropriate type and length. This length will generally be whatever you are ranging over. Fixing the examples from above would look like so:

```Go
// cmd/api/goapi.go:301
missing := make([]string, 0, len(optionalSet))
for feature := range optionalSet {
	missing = append(missing, feature)
}

// cmd/fix/typecheck.go:219
b := make([]ast.Expr, 0, len(a))
for _, x := range a {
	b = append(b, x)
}

// net/internal/socktest/switch.go:34
st := make([]Stat, 0, len(sw.stats))
sw.smu.RLock()
for _, s := range sw.stats {
	ns := *s
	st = append(st, ns)
}
sw.smu.RUnlock()

// cmd/api/goapi.go:301
missing := make ([]string, 0, len(optionalSet))
for feature := range optionalSet {
	missing = append(missing, feature)
}
```



## TODO

- Configuration on whether or not to run on test files
- Support for embedded ifs (currently, prealloc will only find breaks/returns/continues/gotos if they are in a single if block, I'd like to expand this to supporting multiple if blocks in the future).
- Globbing support (e.g. prealloc *.go)


## Contributing

Pull requests welcome!


## Other static analysis tools

If you've enjoyed prealloc, take a look at my other static anaylsis tools!
- [nakedret](https://github.com/alexkohler/nakedret) - Finds naked returns.
- [unimport](https://github.com/alexkohler/unimport) - Finds unnecessary import aliases.
