import { attachDebugger, createLogger } from '@grafana/ui';

export function loadScript(url: string, async = false) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.src = url;
    script.async = async;
    document.head.appendChild(script);
  });
}

/** @internal */
export const echoLogger = createLogger('EchoSrv');
export const echoLog = echoLogger.logger;

attachDebugger('echo', undefined, echoLogger);
