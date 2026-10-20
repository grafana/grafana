# Build Grafana Plugin

## Usage

```
/build-plugin
```

Run this from the root of your plugin directory.

## Steps

1. Detect the package manager. Check the `packageManager` field in `package.json` first, then fall back to lock file detection:

   ```bash
   PKG_MANAGER=$(
     if grep -q '"packageManager"' package.json 2>/dev/null; then
       grep '"packageManager"' package.json | sed -E 's/.*"packageManager" *: *"([^@]+).*/\1/'
     elif [ -f "pnpm-lock.yaml" ]; then
       echo "pnpm"
     elif [ -f "yarn.lock" ]; then
       echo "yarn"
     else
       echo "npm"
     fi
   )
   ```

2. Check if the plugin has a backend:

   ```bash
   HAS_BACKEND=$(grep -c '"backend" *: *true' src/plugin.json || true)
   ```

3. Build the frontend following the build instructions in `.config/AGENTS/instructions.md`. For detailed packaging steps refer to the packaging documentation linked there:

   ```bash
   ${PKG_MANAGER} run build
   ```

   If the build fails, stop and report the error to the user.

4. If `HAS_BACKEND` is non-zero (backend plugin detected), build the backend following the build instructions and packaging documentation linked in `.config/AGENTS/instructions.md`:
   - The backend must be built using `mage` with the build targets provided by the Grafana plugin Go SDK:
     ```bash
     mage -v
     ```
   - If `mage` is not installed, stop and tell the user: "mage is required to build the backend. Install it from https://magefile.org or run: go install github.com/magefile/mage@latest"
   - If the build fails, stop and report the error to the user.
   - After a successful backend build, ensure all backend binaries in `dist/` have execute permissions:
     ```bash
     chmod 0755 dist/gpx_*
     ```
