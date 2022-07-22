def compile_build_cmd():
  return {
        'name': 'compile-build-cmd',
        'image': 'golang:1.17',
        'commands': [
            "go build -o ./bin/build -ldflags '-extldflags -static' ./pkg/build/cmd ",
        ],
        'environment': {
            'CGO_ENABLED': 0,
        },
  }
