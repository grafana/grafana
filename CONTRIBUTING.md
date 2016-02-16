Follow the setup guide in README.md

### Rebuild frontend assets on source change
```
grunt && grunt watch
```

### Rerun tests on source change
```
grunt karma:dev
```

### Run tests before commit
```
grunt test
godep go test -v ./pkg/...
```
