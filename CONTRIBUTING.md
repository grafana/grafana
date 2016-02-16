Follow the setup guide in README.md

### Rebuild frontend assets on source change
```
grunt && grunt watch
```

### Rerun tests on source change
```
grunt karma:dev
```

### Rerun tests for backend assets before commit
```
test -z "$(gofmt -s -l . | grep -v Godeps/_workspace/src/ | tee /dev/stderr)"
```

### Run tests before commit
```
grunt test
godep go test -v ./pkg/...
```
