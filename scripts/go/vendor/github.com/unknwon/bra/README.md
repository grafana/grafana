Brilliant Ridiculous Assistant
==============================

Bra (Brilliant Ridiculous Assistant) is a command line utility tool.

## Usage

```
USAGE:
   Bra [global options] command [command options] [arguments...]

COMMANDS:
   init		initialize config template file
   run		start monitoring and notifying
   help, h	Shows a list of commands or help for one command

GLOBAL OPTIONS:
   --help, -h		show help
   --version, -v	print the version
```

## Quick Start

To work with a new app, you have to have a `.bra.toml` file under the work directory. You can quickly generate a default one by executing following command:

```
$ bra init
```

## FAQs

### How to I gracefully shutdown the application?

Change following values in your `.bra.toml`:

```toml
[run]
interrupt_timout = 15
graceful_kill = true
```

This will send `os.Interrupt` signal first and wait for `15` seconds before force kill.

## Configuration

An example configuration take form [gogsweb](https://github.com/gogits/gogsweb):

```
[run]
init_cmds = [["./gogsweb"]]       # Commands run in start
watch_all = true                  # Watch all sub-directories
watch_dirs = [                    # Directories to watch
  "$WORKDIR/conf",
  "$WORKDIR/models",
  "$WORKDIR/modules",
  "$WORKDIR/routers"
]
watch_exts = [".go", ".ini"]      # Extensions to watch
ignore = [".git", "node_modules"] # Directories to exclude from watching
ignore_files = []                 # Regexps for ignoring specific notifies
follow_symlinks = false           # Enable/disable following symbolic links of sub directories
build_delay = 1500                # Minimal interval to Trigger build event
cmds = [                          # Commands to run
  ["go", "install"],
  ["go", "build"],
  ["./gogsweb"]
]
```

## License

This project is under Apache v2 License. See the [LICENSE](LICENSE) file for the full license text.
