import { Logger } from './logger';

/**
 * Allows debug helpers attachement to the window object
 * @internal
 */
export function attachDebbuger(key: string, thebugger?: any, logger?: Logger) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
    let completeDebugger = thebugger ? { ...thebugger } : {};

    if (logger !== undefined) {
      completeDebugger = { ...completeDebugger, enable: () => logger.enable(), disable: () => logger.disable() };
    }

    // @ts-ignore
    let debugGlobal = window['_debug'];
    if (debugGlobal) {
      debugGlobal = {
        ...debugGlobal,
        [key]: completeDebugger,
      };
    } else {
      debugGlobal = {
        [key]: completeDebugger,
      };
    }
    // @ts-ignore
    window['_debug'] = debugGlobal;
  }
}
