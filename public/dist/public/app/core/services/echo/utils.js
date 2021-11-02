import { attachDebugger, createLogger } from '@grafana/ui';
/** @internal */
export var echoLogger = createLogger('EchoSrv');
export var echoLog = echoLogger.logger;
attachDebugger('echo', undefined, echoLogger);
//# sourceMappingURL=utils.js.map