# Installing grafana-assistant-app for local development

Your `custom.ini` points plugins to `grafana-plugins` (sibling of this repo). The assistant provisioning file expects the plugin to be installed there.

## Option 1: Install via Grafana CLI

From the **grafana repo root**, run (use the same plugins path as in custom.ini):

```bash
# If you have a built binary (e.g. after `make run` or `make build-air`):
./bin/grafana-air cli --pluginsDir=/Users/juanignaciocabanas/Git/grafana/grafana-plugins plugins install grafana-assistant-app

# Or using the config so the CLI uses the same paths as the server:
./bin/grafana-air --config=conf/custom.ini cli --pluginsDir=/Users/juanignaciocabanas/Git/grafana/grafana-plugins plugins install grafana-assistant-app

# If you don't have a binary, build and run CLI with go:
go run ./pkg/cmd/grafana --homepath=. cli --pluginsDir=/Users/juanignaciocabanas/Git/grafana/grafana-plugins plugins install grafana-assistant-app
```

If the plugin is not in the public catalog, the CLI will fail. In that case use Option 2.

## Option 2: Clone and build from source

The plugin lives in a separate repo. To build and install it into your plugins directory:

1. Clone and build the plugin (sibling to your grafana repo):

   ```bash
   cd /Users/juanignaciocabanas/Git/grafana
   git clone https://github.com/grafana/grafana-assistant-app.git
   cd grafana-assistant-app
   yarn install
   yarn build
   ```

2. Link or copy the built plugin into your plugins directory:

   ```bash
   # From grafana-assistant-app repo root, the built plugin is usually in dist/ or similar.
   # Create a symlink (or copy) so Grafana finds it:
   ln -sfn "$(pwd)/dist" /Users/juanignaciocabanas/Git/grafana/grafana-plugins/grafana-assistant-app
   # Or, if the build outputs to the repo root:
   ln -sfn "$(pwd)" /Users/juanignaciocabanas/Git/grafana/grafana-plugins/grafana-assistant-app
   ```

3. Restart Grafana and ensure `conf/provisioning/plugins/assistant.yaml` is enabled (not renamed to `.disabled`).

Check the grafana-assistant-app repo’s README for the exact build command and output directory.
