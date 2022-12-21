# Sankey plugin

## How to work with it?

We created our fork of [snakey-panel](https://github.com/IsmaelMasharo/sankey-panel) ---> [our fork](https://github.com/fluxninja/sankey-panel) and if we want to add some changes to it we need to:
- git clone our fork
- add changes we want
- build plugin using `yarn build` (if you want to test something use `yarn dev` because the normal build removes all console.logs)
- copy-paste builded version of plugin into grafana `public/app/plugins/panel/sankey-panel-0.5.0`
- refresh grafana


# Troubleshooting

## "Cannot find module" typescript errors (ts2307)

Smart IDEs (such as VSCode or IntelliJ) require special configuration for TypeScript to work when using Plug'n'Play installs.
A collection of settings for each editor can be found under the (link)[https://yarnpkg.com/getting-started/editor-sdks#vscode]

Generally speaking: the editor SDKs and settings can be generated using `yarn dlx @yarnpkg/sdks` (or yarn sdks if you added @yarnpkg/sdks to your dependencies):
- Use yarn sdks vscode vim to generate both the base SDKs and the settings for the specified supported editors.
- Use yarn sdks base to generate the base SDKs and then manually tweak the configuration of unsupported editors.
- Use yarn sdks to update all installed SDKs and editor settings.


### VSCode

To support features like go-to-definition a plugin like ZipFS is needed.

Run the following command, which will generate a new directory called .yarn/sdks:
`yarn dlx @yarnpkg/sdks vscode`

For safety reason VSCode requires you to explicitly activate the custom TS settings:

- Press ctrl+shift+p in a TypeScript file
- Choose "Select TypeScript Version"
- Pick "Use Workspace Version"
