# Validate Grafana Plugin

## Important

Always use the bash commands below directly.

## Usage

```
/validate-plugin
```

Run this from the root of your plugin directory.

## Steps

1. Check if `npx` or `docker` is available. npx is preferred, docker is the fallback:

   ```bash
   RUN_ENGINE=$(command -v npx >/dev/null 2>&1 && echo "npx" || (command -v docker >/dev/null 2>&1 && echo "docker" || echo "none"))
   ```

   If `RUN_ENGINE` is `none`, stop immediately and tell the user: "Neither npx nor docker is installed. Please install Node.js (for npx) or Docker to run the plugin validator."

2. Extract the plugin ID from `src/plugin.json` (or `plugin.json`). Sanitize `PLUGIN_ID` to only allow characters valid in a Grafana plugin ID:

   ```bash
   PLUGIN_ID=$(grep '"id"' < src/plugin.json | sed -E 's/.*"id" *: *"(.*)".*/\1/' | tr -cd 'a-zA-Z0-9._-')
   ```

3. Run the `build-plugin` skill to build the plugin (frontend and backend if applicable).

4. Build the plugin zip archive for validation with a timestamp:

   ```bash
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   ZIP_NAME="${PLUGIN_ID}-${TIMESTAMP}.zip"
   cp -r dist "${PLUGIN_ID}"
   zip -qr "${ZIP_NAME}" "${PLUGIN_ID}"
   rm -rf "${PLUGIN_ID}"
   ```

5. Run the validator with JSON output using `$RUN_ENGINE` from step 1 and `$ZIP_NAME` from step 4:
   If `$RUN_ENGINE` is `npx`:

   ```bash
   npx --cache .cache/npm -y @grafana/plugin-validator@latest -jsonOutput $ZIP_NAME
   ```

   If `$RUN_ENGINE` is `docker`:

   ```bash
   docker run --pull=always \
     -v "${PWD}/${ZIP_NAME}:/archive.zip:ro" \
     grafana/plugin-validator-cli -jsonOutput /archive.zip
   ```

6. Read and interpret the JSON output. Summarize:
   - Total errors, warnings, and passed checks
   - List each error with its title and detail
   - List each warning with its title and detail
   - Provide actionable suggestions to fix each issue

7. Inform the user that a zip file was created (include the filename) and suggest they remove it manually when done. Do NOT run `rm` to delete the zip — this tool does not have permission to remove files.
