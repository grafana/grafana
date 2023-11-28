import { __awaiter } from "tslib";
import { processPromiseResults, filterFulfilled, filterRejected, } from './promises';
describe('processPromiseResults::', () => {
    it('should return array of fulfilled promise results', () => __awaiter(void 0, void 0, void 0, function* () {
        const requests = [Promise.resolve(), Promise.resolve()];
        const results = yield processPromiseResults(requests);
        expect(results.map(filterFulfilled).length).toBe(2);
    }));
    it('should return one fulfilled promise and two rejected', () => __awaiter(void 0, void 0, void 0, function* () {
        const requests = [Promise.reject(), Promise.resolve(), Promise.reject()];
        const results = yield processPromiseResults(requests);
        expect(results.filter(filterFulfilled).length).toBe(1);
        expect(results.filter(filterRejected).length).toBe(2);
    }));
    it('should return one fulfilled promise with value', () => __awaiter(void 0, void 0, void 0, function* () {
        const requests = [Promise.resolve('done')];
        const results = yield processPromiseResults(requests);
        const fulfilled = results.filter(filterFulfilled);
        expect(fulfilled[0].value).toBe('done');
        expect(results.length).toBe(1);
    }));
    it('should return two rejected promises with value', () => __awaiter(void 0, void 0, void 0, function* () {
        const error1 = new Error('rejected 1');
        const error2 = new Error('rejected 2');
        const requests = [Promise.reject(error1), Promise.reject(error2)];
        const results = yield processPromiseResults(requests);
        const rejected = results.filter(filterRejected);
        expect(rejected[0].reason).toEqual(error1);
        expect(rejected[1].reason).toBe(error2);
        expect(results.length).toBe(2);
    }));
    it('should return array empty array', () => __awaiter(void 0, void 0, void 0, function* () {
        const requests = [];
        const results = yield processPromiseResults(requests);
        expect(results.length).toBe(0);
    }));
});
//# sourceMappingURL=promises.test.js.map