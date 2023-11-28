/**
 * Allows debug helpers attachement to the window object
 * @internal
 */
export function attachDebugger(key, thebugger, logger) {
    var _a;
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    let completeDebugger = thebugger || {};
    if (logger !== undefined) {
        completeDebugger = Object.assign(Object.assign({}, completeDebugger), { enable: () => logger.enable(), disable: () => logger.disable() });
    }
    // @ts-ignore
    let debugGlobal = (_a = (typeof window !== 'undefined' && window['_debug'])) !== null && _a !== void 0 ? _a : {};
    debugGlobal[key] = completeDebugger;
    if (typeof window !== 'undefined') {
        // @ts-ignore
        window['_debug'] = debugGlobal;
    }
}
//# sourceMappingURL=debug.js.map