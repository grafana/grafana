Follow the setup guide in README.md

### Rebuild frontend assets on source change
```
grunt && grunt watch
```

### Rerun tests on source change
```
grunt karma:dev
```

### Run tests for backend assets before commit
```
test -z "$(gofmt -s -l . | grep -v -E 'vendor/(github.com|golang.org|gopkg.in)' | tee /dev/stderr)"
```

### Run tests for frontend assets before commit
```
npm test
go test -v ./pkg/...
```
