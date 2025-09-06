# Wire Checker

A static analysis tool that detects direct dependency method calls in wire provider functions, helping maintain proper dependency injection patterns.

## Overview

Wire Checker analyzes Go code to find provider functions that directly call methods on their dependencies, which can lead to tight coupling and violate dependency injection principles. It supports both standalone usage and integration with golangci-lint.

## Features

- **Direct Dependency Detection**: Identifies method calls on injected dependencies within provider functions
- **Recursive Analysis**: Optionally analyzes function calls within providers to detect transitive dependencies
- **Wire Integration**: Parses `wire_gen.go` files to identify which functions should be analyzed
- **golangci-lint Plugin**: Can be used as a golangci-lint plugin for seamless CI/CD integration

## Usage

### Standalone

```bash
go run ./cmd/wirecheck -wire-gen=path/to/wire_gen.go [-recursive] ./packages/to/analyze/...
```

**Flags:**
- `-wire-gen`: Path to the wire_gen.go file (required)
- `-recursive`: Enable recursive analysis of function calls (optional)

### golangci-lint Plugin

The wirechecker is configured as a Go plugin for golangci-lint. First, build the plugin:

```bash
make build-wirechecker-plugin
```

This creates `tools/wirechecker/wirechecker.so`. The plugin is configured in `.golangci.yml`:

```yaml
linters:
  enable:
    - wirechecker
  settings:
    custom:
      wirechecker:
        path: ./tools/wirechecker/wirechecker.so
        description: Check for direct dependency method calls in wire provider functions
        original-url: github.com/grafana/grafana/scripts/go/wirechecker
        settings:
          wire-gen: ./pkg/server/wire_gen.go
          recursive: true
```

Then run:
```bash
golangci-lint run --enable=wirechecker
```

**Note**: Go plugins require exact dependency version matching with golangci-lint. If you encounter plugin compatibility issues, you may need to rebuild golangci-lint from source or use the standalone version instead.

## Configuration

### Settings

- `wire-gen` (string): Path to the wire_gen.go file that contains the Initialize functions
- `recursive` (bool): Enable recursive analysis to detect transitive dependency calls

## Example

Given this problematic provider function:

```go
func ProvideUserService(db *Database, logger *Logger) *UserService {
    // BAD: Direct method calls on dependencies
    db.Connect()                    // ❌ Will be detected
    logger.Log("Initializing...")   // ❌ Will be detected
    
    return NewUserService(db, logger)
}
```

Wire Checker will report:
```
provide.go:95:2: ProvideUserService() directly calls db.Connect() in wire provider function
provide.go:96:2: ProvideUserService() directly calls logger.Log() in wire provider function
```

### Good Practice

Instead, provider functions should only construct and return instances:

```go
func ProvideUserService(db *Database, logger *Logger) *UserService {
    // GOOD: Only construction, no method calls
    return NewUserService(db, logger)
}
```

## How It Works

1. **Parse Wire File**: Analyzes the specified `wire_gen.go` file to extract provider function names
2. **Function Analysis**: Examines each provider function for method calls on parameters
3. **Recursive Analysis**: (Optional) Follows function calls within providers to detect indirect dependencies
4. **Report Issues**: Reports any direct method calls on injected dependencies

## Integration with CI/CD

The tool returns a non-zero exit code when issues are found, making it suitable for CI/CD pipelines to enforce dependency injection best practices.
