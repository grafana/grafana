#!/usr/bin/env node

const {existsSync} = require(`fs`);
const {createRequire, createRequireFromPath} = require(`module`);
const {resolve} = require(`path`);

const relPnpApiPath = "../../../../.pnp.cjs";

const absPnpApiPath = resolve(__dirname, relPnpApiPath);
const absRequire = (createRequire || createRequireFromPath)(absPnpApiPath);

const moduleWrapper = tsserver => {
  if (!process.versions.pnp) {
    return tsserver;
  }

  const {isAbsolute} = require(`path`);
  const pnpApi = require(`pnpapi`);

  const isVirtual = str => str.match(/\/(\$\$virtual|__virtual__)\//);
  const normalize = str => str.replace(/\\/g, `/`).replace(/^\/?/, `/`);

  const dependencyTreeRoots = new Set(pnpApi.getDependencyTreeRoots().map(locator => {
    return `${locator.name}@${locator.reference}`;
  }));

  // VSCode sends the zip paths to TS using the "zip://" prefix, that TS
  // doesn't understand. This layer makes sure to remove the protocol
  // before forwarding it to TS, and to add it back on all returned paths.

  function toEditorPath(str) {
    // We add the `zip:` prefix to both `.zip/` paths and virtual paths
    if (isAbsolute(str) && !str.match(/^\^zip:/) && (str.match(/\.zip\//) || isVirtual(str))) {
      // We also take the opportunity to turn virtual paths into physical ones;
      // this makes it much easier to work with workspaces that list peer
      // dependencies, since otherwise Ctrl+Click would bring us to the virtual
      // file instances instead of the real ones.
      //
      // We only do this to modules owned by the the dependency tree roots.
      // This avoids breaking the resolution when jumping inside a vendor
      // with peer dep (otherwise jumping into react-dom would show resolution
      // errors on react).
      //
      const resolved = isVirtual(str) ? pnpApi.resolveVirtual(str) : str;
      if (resolved) {
        const locator = pnpApi.findPackageLocator(resolved);
        if (locator && dependencyTreeRoots.has(`${locator.name}@${locator.reference}`)) {
          str = resolved;
        }
      }

      str = normalize(str);

      if (str.match(/\.zip\//)) {
        switch (hostInfo) {
          // Absolute VSCode `Uri.fsPath`s need to start with a slash.
          // VSCode only adds it automatically for supported schemes,
          // so we have to do it manually for the `zip` scheme.
          // The path needs to start with a caret otherwise VSCode doesn't handle the protocol
          //
          // Ref: https://github.com/microsoft/vscode/issues/105014#issuecomment-686760910
          //
          case `vscode`: {
            str = `^zip:${str}`;
          } break;

          // To make "go to definition" work,
          // We have to resolve the actual file system path from virtual path
          // and convert scheme to supported by [vim-rzip](https://github.com/lbrayner/vim-rzip)
          case `coc-nvim`: {
            str = normalize(resolved).replace(/\.zip\//, `.zip::`);
            str = resolve(`zipfile:${str}`);
          } break;

          // Support neovim native LSP and [typescript-language-server](https://github.com/theia-ide/typescript-language-server)
          // We have to resolve the actual file system path from virtual path,
          // everything else is up to neovim
          case `neovim`: {
            str = normalize(resolved).replace(/\.zip\//, `.zip::`);
            str = `zipfile:${str}`;
          } break;

          default: {
            str = `zip:${str}`;
          } break;
        }
      }
    }

    return str;
  }

  function fromEditorPath(str) {
    return process.platform === `win32`
      ? str.replace(/^\^?zip:\//, ``)
      : str.replace(/^\^?zip:/, ``);
  }

  // Force enable 'allowLocalPluginLoads'
  // TypeScript tries to resolve plugins using a path relative to itself
  // which doesn't work when using the global cache
  // https://github.com/microsoft/TypeScript/blob/1b57a0395e0bff191581c9606aab92832001de62/src/server/project.ts#L2238
  // VSCode doesn't want to enable 'allowLocalPluginLoads' due to security concerns but
  // TypeScript already does local loads and if this code is running the user trusts the workspace
  // https://github.com/microsoft/vscode/issues/45856
  const ConfiguredProject = tsserver.server.ConfiguredProject;
  const {enablePluginsWithOptions: originalEnablePluginsWithOptions} = ConfiguredProject.prototype;
  ConfiguredProject.prototype.enablePluginsWithOptions = function() {
    this.projectService.allowLocalPluginLoads = true;
    return originalEnablePluginsWithOptions.apply(this, arguments);
  };

  // And here is the point where we hijack the VSCode <-> TS communications
  // by adding ourselves in the middle. We locate everything that looks
  // like an absolute path of ours and normalize it.

  const Session = tsserver.server.Session;
  const {onMessage: originalOnMessage, send: originalSend} = Session.prototype;
  let hostInfo = `unknown`;

  Object.assign(Session.prototype, {
    onMessage(/** @type {string} */ message) {
      const parsedMessage = JSON.parse(message)

      if (
        parsedMessage != null &&
        typeof parsedMessage === `object` &&
        parsedMessage.arguments &&
        typeof parsedMessage.arguments.hostInfo === `string`
      ) {
        hostInfo = parsedMessage.arguments.hostInfo;
      }

      return originalOnMessage.call(this, JSON.stringify(parsedMessage, (key, value) => {
        return typeof value === `string` ? fromEditorPath(value) : value;
      }));
    },

    send(/** @type {any} */ msg) {
      return originalSend.call(this, JSON.parse(JSON.stringify(msg, (key, value) => {
        return typeof value === `string` ? toEditorPath(value) : value;
      })));
    }
  });

  return tsserver;
};

if (existsSync(absPnpApiPath)) {
  if (!process.versions.pnp) {
    // Setup the environment to be able to require typescript/lib/tsserverlibrary.js
    require(absPnpApiPath).setup();
  }
}

// Defer to the real typescript/lib/tsserverlibrary.js your application uses
module.exports = moduleWrapper(absRequire(`typescript/lib/tsserverlibrary.js`));
