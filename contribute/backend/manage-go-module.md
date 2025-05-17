# Managing Go Modules in Grafana

## Creating a New Module

### Best Practices for Module Creation

Create a new module when:

1. The code has a distinct responsibility or domain
2. The code needs its own dependency management
3. The code might be used independently of Grafana
4. The code has complex dependencies that should be isolated
5. The code needs to be versioned independently

6. Initialize the module:

```bash
cd pkg/your/new/module
go mod init github.com/grafana/grafana/pkg/your/new/module
```

2. Update the workspace:

```bash
make update-workspace
```

3. Add module reference to `go.work` file

4. Update module consumers
   If other modules depend on the new module you are introducing, you migh need to temporarily add a replace directive to these consumer modules, while the newly introduced module is not published / in the main branch. You can add a replace directive like this:

```go
// In your module's go.mod
replace github.com/grafana/grafana/pkg/<my-module> => ../../../<my-module>
```

5. Upadte `Dockerfile` to include the new module
   Example:

```dockerfile
# Dockerfile
COPY pkg/your/new/module ./pkg/your/new/module
```

6. Add module to `dependabot.yml` for dependency updates

Example:

```yaml
# .github/dependabot.yml
updates:
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'daily'
  - package-ecosystem: 'gomod'
    directories:
      - '/'
      - '/pkg/your/new/module' # Add your new module here
```

[!IMPORTANT]
When running the command above, you may notice there will be some `invalid revision version` errors. This is because the module doesn't exist in the main branch yet and the root `go.mod` can't find a reference to the new module yet.

2. Second PR (after first PR is merged):
   - Run `make update-workspace` again
   - This will update the module versions in the root `go.mod`
   - The module will now be properly referenced from main
   - You can now remove replace directives from your module
