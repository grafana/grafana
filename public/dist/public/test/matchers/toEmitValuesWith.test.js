import { __awaiter } from "tslib";
import { interval, of, throwError } from 'rxjs';
import { map, mergeMap, take } from 'rxjs/operators';
import { OBSERVABLE_TEST_TIMEOUT_IN_MS } from './types';
describe('toEmitValuesWith matcher', () => {
    describe('failing tests', () => {
        describe('passing null in expect', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = null;
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([1, 2, 3]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe('passing undefined in expect', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = undefined;
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([1, 2, 3]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe('passing number instead of Observable in expect', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = 1;
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([1, 2, 3]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe('wrong number of emitted values', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(take(3));
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([0, 1]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe('wrong emitted values', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(take(3));
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([1, 2, 3]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe('wrong emitted value types', () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(take(3));
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual(['0', '1', '2']);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
        describe(`observable that does not complete within ${OBSERVABLE_TEST_TIMEOUT_IN_MS}ms`, () => {
            it('should fail with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(600);
                const rejects = expect(() => expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([0]);
                })).rejects;
                yield rejects.toThrow();
            }));
        });
    });
    describe('passing tests', () => {
        describe('correct emitted values', () => {
            it('should pass with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(take(3));
                yield expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([0, 1, 2]);
                });
            }));
        });
        describe('correct emitted values with throw', () => {
            it('should pass with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(map((interval) => {
                    if (interval > 1) {
                        throw 'an error';
                    }
                    return interval;
                }));
                yield expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([0, 1, 'an error']);
                });
            }));
        });
        describe('correct emitted values with throwError', () => {
            it('should pass with correct message', () => __awaiter(void 0, void 0, void 0, function* () {
                const observable = interval(10).pipe(mergeMap((interval) => {
                    if (interval === 1) {
                        return throwError('an error');
                    }
                    return of(interval);
                }));
                yield expect(observable).toEmitValuesWith((received) => {
                    expect(received).toEqual([0, 'an error']);
                });
            }));
        });
    });
});
//# sourceMappingURL=toEmitValuesWith.test.js.map