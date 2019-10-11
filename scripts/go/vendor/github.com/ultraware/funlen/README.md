# Funlen linter

Funlen is a linter that checks for long functions. It can checks both on the number of lines and the number of statements.

The default limits are 50 lines and 35 statements. You can configure these with the `-l` and `-s` flags.

Example code:

```go
package main

import "fmt"

func fiveStatements() {
    fmt.Println(1)
    fmt.Println(2)
    fmt.Println(3)
    fmt.Println(4)
    fmt.Println(5)
}

func sevenLines() {
    fmt.Println(1)

    fmt.Println(2)

    fmt.Println(3)

    fmt.Println(4)
}
```

Reults in:

```
$ funlen -l=6 -s=4 .
main.go:5:6:Function 'fiveStatements' has too many statements (5 > 4)
main.go:13:6:Function 'sevenLines' is too long (7 > 6)
```

## Installation guide

```bash
go get git.ultraware.nl/NiseVoid/funlen
```

### Gometalinter

You can add funlen to gometalinter and enable it.

`.gometalinter.json`:

```json
{
	"Linters": {
		"funlen": "funlen -l=50 -s=35:PATH:LINE:COL:MESSAGE"
	},

	"Enable": [
		"funlen"
	]
}
```

commandline:

```bash
gometalinter --linter "funlen:funlen -l=50 -s=35:PATH:LINE:COL:MESSAGE" --enable "funlen"
```
