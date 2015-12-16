declare module "assert" {
    function ok(test: any, message?: string): void;
    function fail(message?: string): void;
    function equal(actual: any, expected: any, message?: string): void;
    function notEqual(actual: any, expected: any, message?: string): void;
    function deepEqual(actual: any, expected: any, message?: string): void;
    function notDeepEqual(actual: any, expected: any, message?: string): void;
    function strictEqual(actual: any, expected: any, message?: string): void;
    function notStrictEqual(actual: any, expected: any, message?: string): void;
    function throws(block: () => void, error?: ErrorConstructor | RegExp | ((err: any) => boolean), message?: string): void;
    function doesNotThrow(block: () => void, message?: string): void;
    function ifError(value: any): boolean;
}