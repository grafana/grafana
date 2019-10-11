[![Build Status](https://travis-ci.org/mgechev/dots.svg?branch=master)](https://travis-ci.org/mgechev/dots)

# Dots

Implements the wildcard file matching in Go used by golint, go test etc.

## Usage

```go
import "github.com/mgechev/dots"

func main() {
  result, err := dots.Resolve([]string{"./fixtures/..."}, []string{"./fixtures/foo"})
  for _, f := range result {
    fmt.Println(f);
  }
}
```

If we suppose that we have the following directory structure:

```text
├── README.md
├── fixtures
│   ├── bar
│   │   ├── bar1.go
│   │   └── bar2.go
│   ├── baz
│   │   ├── baz1.go
│   │   ├── baz2.go
│   │   └── baz3.go
│   └── foo
│       ├── foo1.go
│       ├── foo2.go
│       └── foo3.go
└── main.go
```

The result will be:

```text
fixtures/bar/bar1.go
fixtures/bar/bar2.go
fixtures/baz/baz1.go
fixtures/baz/baz2.go
fixtures/baz/baz3.go
```

`dots` supports wildcard in both - the first and the last argument of `Resolve`, which means that you can ignore files based on a wildcard:

```go
dots.Resolve([]string{"github.com/mgechev/dots"}, []string{"./..."}) // empty list
dots.Resolve([]string{"./fixtures/bar/..."}, []string{"./fixture/foo/...", "./fixtures/baz/..."}) // bar1.go, bar2.go
```

## Preserve package structure

`dots` allow you to receive a slice of slices where each nested slice represents an individual package:

```go
dots.ResolvePackages([]string{"github.com/mgechev/dots/..."}, []string{})
```

So we will get the result:

```text
[
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/bar/bar1.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/bar/bar2.go"
  ],
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/baz/baz1.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/baz/baz2.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/baz/baz3.go"
  ],
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/foo/foo1.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/foo/foo2.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/dummy/foo/foo3.go"
  ],
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/pkg/baz/baz1.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/pkg/baz/baz2.go"
  ],
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/pkg/foo/foo1.go",
    "$GOROOT/src/github.com/mgechev/dots/fixtures/pkg/foo/foo2.go"
  ],
  [
    "$GOROOT/src/github.com/mgechev/dots/fixtures/pkg/foo/bar/bar1.go"
  ]
]
```

This method is especially useful, when you want to perform type checking ovr given package from the result.

## License

MIT
