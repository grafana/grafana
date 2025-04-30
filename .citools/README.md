## API

### Adding and Upgrading tools

To add a new tool please execute the installation script

```bash
install.sh <tool>
```

#### Example

Following command will add lefthook to the tracked tools if it was not installed previously, or update the tool version

```bash
install.sh github.com/evilmartians/lefthook@v1.11.10
```

Behind the scene the script will do a couple of simple steps

- Create a go module under `.citools/src/<toolname>` directory to track the tool version and it's dependencies
- Create a reference to the tool binary in the `.citools/Variables.mk` file

### Using tools in the Makefile

Our makefile imports .citools/Variables.mk, you can simply call a tool binary using make syntax

#### Example:

```make
run:
    $(bra) run
```

### Using tracked tools w/o makefile

If you want to use tools outside of Makefile, you can locate the tool binary by executing following command

```
GOWORK=off go tool -n -modfile=<path_to_modilfe> <toolname>
```

You can also try checking the cache file containing the latest path to binary `.tool-cache/<name>.path`
