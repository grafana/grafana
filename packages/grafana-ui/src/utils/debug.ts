import { Logger } from './logger';

/**
 * Allows debug helpers attachement to the window object
 * @internal
 */
export function attachDebugger(key: string, thebugger?: any, logger?: Logger) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  let completeDebugger = thebugger || {};

  if (logger !== undefined) {
    completeDebugger = { ...completeDebugger, enable: () => logger.enable(), disable: () => logger.disable() };
  }

  // @ts-ignore
  let debugGlobal = (typeof window !== 'undefined' && window['_debug']) ?? {};
  debugGlobal[key] = completeDebugger;
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window['_debug'] = debugGlobal;
  }
}
