Follow the setup guide in README.md

### Rebuild frontend assets on source change
```
yarn watch
```

### Rerun tests on source change
```
yarn jest
```

### Run tests for backend assets before commit
```
test -z "$(gofmt -s -l . | grep -v -E 'vendor/(github.com|golang.org|gopkg.in)' | tee /dev/stderr)"
```

### Run tests for frontend assets before commit
```
yarn test
go test -v ./pkg/...
```
