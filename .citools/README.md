## Adding New Tools or upgrading existing tools

### Adding tools

To add a new tool please execute the installation script

```bash
.citools/install.sh <name>
```

Following command will add lefthook to the tracked tools if it was not installed previously, or update the tool version

```bash
.citools/install.sh github.com/evilmartians/lefthook@v1.11.10
```

The script will create a go module under `.citools/src/<toolname>` directory to track the tool version and create a reference in the `.citools/Variables.mk` file

### Using tracked tools w/o makefile

If you want to use tool outside of Make file, you can locate the tool binary by executing following command

```
GOWORK=off go tool -n -modfile=<path_to_modilfe> <toolname>
```
