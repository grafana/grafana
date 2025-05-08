## API

### Adding and Upgrading Tools

To add a new tool, execute the installation script:

```bash
install.sh <tool>
```

#### Example

The following command will add `lefthook` to the tracked tools if it is not already installed, or update its version:

```bash
install.sh github.com/evilmartians/lefthook@v1.11.10
```

Behind the scenes, the script performs a few simple steps:

- Creates a Go module under the `.citools/src/<toolname>` directory to track the tool version and its dependencies.
- Creates a reference to the tool binary in the `.citools/Variables.mk` file.

### Using Tools in the Makefile

Our Makefile imports `.citools/Variables.mk`, so you can call a tool binary using standard Make syntax.

#### Example

```make
run:
    $(bra) run
```

### Using Tracked Tools Without the Makefile

If you want to use a tool outside of the Makefile, you can locate the tool binary by executing the following command:

```bash
GOWORK=off go tool -n -modfile=<path_to_modfile> <toolname>
```

You can also check the cache file containing the latest path to the binary:

```
.tool-cache/<name>.path
```
