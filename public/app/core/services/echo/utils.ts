import { attachDebugger, createLogger } from '@grafana/ui';

export async function loadScript(url: string) {
  return System.import(url).then((m) => (m.default ? m.default : m));
}

/** @internal */
export const echoLogger = createLogger('EchoSrv');
export const echoLog = echoLogger.logger;

attachDebugger('echo', undefined, echoLogger);
