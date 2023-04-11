import { pluginSandboxConsolePrefix } from './constants';

export function getSandboxedWebApis({ pluginId }: { pluginId: string; isDevMode: boolean }) {
  const sandboxLog = function (...args: unknown[]) {
    console.log(`${pluginSandboxConsolePrefix} ${pluginId}:`, ...args);
  };

  return {
    alert: function (message: string) {
      sandboxLog('alert()', message);
    },
    console: {
      log: sandboxLog,
      warn: sandboxLog,
      error: sandboxLog,
      info: sandboxLog,
      debug: sandboxLog,
    },
    fetch: function (url: string, options: unknown) {
      sandboxLog('fetch()', url, options);
      return Promise.reject('fetch() is not allowed in plugins');
    },
  };
}
