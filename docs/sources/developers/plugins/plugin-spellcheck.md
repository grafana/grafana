---
title: Configuring plugin spellcheck
description: Internal docs on how to setup the plugin spellcheck
draft: true
---

# Configuring plugin spellcheck

> ℹ️ This process is applicable only for grafana maintained plugins and only if the plugins are activated in drone.grafana.net for CI process.

## What it is and why it is required

The spellcheck CI step performs basic spellcheck against the plugin code and documentation.\
It helps us to avoid showing things like this to our customers:

![image](https://user-images.githubusercontent.com/1436174/208397307-4270cb57-b538-4c68-8b0f-67ab5d3b8dad.png)

At the moment spellcheck is mandatory for all internal plugins.

Under the hood, the pipeline uses [cspell npm package](https://www.npmjs.com/package/cspell) to perform the spellcheck.

## Steps to configure spellcheck

If you ended up here following the link from the failing CI then most probably you don't have spellcheck configured for your plugin. Follow the below steps to set it up.

1. Install cspell package to your plugin's repo:

```bash
yarn add -D cspell@6.13.3
```

3. Add `spellcheck` command to the `scripts` section in `package.json` of your plugin:

```
"spellcheck": "cspell -c cspell.config.json \"**/*.{ts,tsx,js,go,md,mdx,yml,yaml,json,scss,css}\""
```

3. Create a `cspell.config.json` file in the repo root folder and add a basic config there:

```json
{
  "ignorePaths": [
    "coverage/**",
    "cypress/**",
    "dist/**",
    "go.sum",
    "mage_output_file.go",
    "node_modules/**",
    "provisioning/**/*.yaml",
    "src/dashboards/*.json",
    "**/testdata/**/*.json",
    "**/testdata/**/*.jsonc",
    "vendor/**",
    "cspell.config.json",
    "package.json",
    "yarn.lock",
    "docker-compose*.yaml",
    "docker-compose*.yml"
  ],
  "ignoreRegExpList": [
    // ignore multiline imports
    "import\\s*\\((.|[\r\n])*?\\)",
    // ignore single line imports
    "import\\s*.*\".*?\""
  ],
  "words": ["grafana", "datasource", "datasources"]
}
```

4. Run `yarn spellcheck` to see if there are any misspellings
5. If errors found, either fix them or add to `ignorePaths` or `words` section of the `cspell.config.json` created earlier

Sample PR to add spellcheck to your repo: https://github.com/grafana/athena-datasource/pull/185/files
