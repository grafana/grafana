/// <reference path="../es6-shim/es6-shim.d.ts" />

declare class Zone {
    constructor(parentZone: Zone, data: any);

    fork(locals: {[key: string]: any}): Zone;
    bind(fn: Function, skipEnqueue?: boolean): void;
    bindOnce(fn: Function): any;
    run(fn: Function, applyTo?: any, applyWith?: any): void;
    isRootZone(): boolean;

    static bindPromiseFn<T extends () => Promise<any>>(fn: T): T;

    static longStackTraceZone: {[key: string]: any};
}
