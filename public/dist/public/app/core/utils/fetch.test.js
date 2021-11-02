import { __assign, __awaiter, __generator, __makeTemplateObject } from "tslib";
import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import { isContentTypeApplicationJson, parseBody, parseCredentials, parseHeaders, parseInitFromOptions, parseResponseBody, parseUrlFromOptions, } from './fetch';
describe('parseUrlFromOptions', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    params                                                      | url                | expected\n    ", "                                                | ", " | ", "\n    ", "                                         | ", " | ", "\n    ", "                                       | ", " | ", "\n    ", " | ", " | ", "\n    ", "      | ", " | ", "\n    ", "                                        | ", " | ", "\n    ", "                                               | ", " | ", "\n  "], ["\n    params                                                      | url                | expected\n    ", "                                                | ", " | ", "\n    ", "                                         | ", " | ", "\n    ", "                                       | ", " | ", "\n    ", " | ", " | ", "\n    ", "      | ", " | ", "\n    ", "                                        | ", " | ", "\n    ", "                                               | ", " | ", "\n  "])), undefined, 'api/dashboard', 'api/dashboard', { key: 'value' }, 'api/dashboard', 'api/dashboard?key=value', { key: undefined }, 'api/dashboard', 'api/dashboard', { firstKey: 'first value', secondValue: 'second value' }, 'api/dashboard', 'api/dashboard?firstKey=first%20value&secondValue=second%20value', { firstKey: 'first value', secondValue: undefined }, 'api/dashboard', 'api/dashboard?firstKey=first%20value', { id: [1, 2, 3] }, 'api/dashboard', 'api/dashboard?id=1&id=2&id=3', { id: [] }, 'api/dashboard', 'api/dashboard')("when called with params: '$params' and url: '$url' then result should be '$expected'", function (_a) {
        var params = _a.params, url = _a.url, expected = _a.expected;
        expect(parseUrlFromOptions({ params: params, url: url })).toEqual(expected);
    });
});
describe('parseInitFromOptions', function () {
    it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    method       | data           | withCredentials | credentials  | expected\n    ", " | ", "   | ", "    | ", " | ", "\n    ", "     | ", "   | ", "    | ", " | ", "\n    ", "    | ", " | ", "    | ", " | ", "\n    ", "     | ", " | ", "    | ", " | ", "\n    ", "  | ", "   | ", "    | ", "    | ", "\n    ", "     | ", "   | ", "         | ", " | ", "\n    ", "     | ", "   | ", "         | ", "    | ", "\n  "], ["\n    method       | data           | withCredentials | credentials  | expected\n    ", " | ", "   | ", "    | ", " | ", "\n    ", "     | ", "   | ", "    | ", " | ", "\n    ", "    | ", " | ", "    | ", " | ", "\n    ", "     | ", " | ", "    | ", " | ", "\n    ", "  | ", "   | ", "    | ", "    | ", "\n    ", "     | ", "   | ", "         | ", " | ", "\n    ", "     | ", "   | ", "         | ", "    | ", "\n  "])), undefined, undefined, undefined, undefined, { method: undefined, headers: { map: { accept: 'application/json, text/plain, */*' } }, body: undefined, credentials: 'same-origin' }, 'GET', undefined, undefined, undefined, { method: 'GET', headers: { map: { accept: 'application/json, text/plain, */*' } }, body: undefined, credentials: 'same-origin' }, 'POST', { id: '0' }, undefined, undefined, { method: 'POST', headers: { map: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*' } }, body: '{"id":"0"}', credentials: 'same-origin' }, 'PUT', { id: '0' }, undefined, undefined, { method: 'PUT', headers: { map: { 'content-type': 'application/json', accept: 'application/json, text/plain, */*' } }, body: '{"id":"0"}', credentials: 'same-origin' }, 'monkey', undefined, undefined, 'omit', { method: 'monkey', headers: { map: { accept: 'application/json, text/plain, */*' } }, body: undefined, credentials: 'omit' }, 'GET', undefined, true, undefined, { method: 'GET', headers: { map: { accept: 'application/json, text/plain, */*' } }, body: undefined, credentials: 'include' }, 'GET', undefined, true, 'omit', { method: 'GET', headers: { map: { accept: 'application/json, text/plain, */*' } }, body: undefined, credentials: 'omit' })("when called with method: '$method', data: '$data', withCredentials: '$withCredentials' and credentials: '$credentials' then result should be '$expected'", function (_a) {
        var method = _a.method, data = _a.data, withCredentials = _a.withCredentials, credentials = _a.credentials, expected = _a.expected;
        expect(parseInitFromOptions({ method: method, data: data, withCredentials: withCredentials, credentials: credentials, url: '' })).toEqual(expected);
    });
});
describe('parseHeaders', function () {
    it.each(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    options                                                                                 | expected\n    ", "                                                                            | ", "\n    ", "                                                       | ", "\n    ", "                                                                    | ", "\n    ", "                                                                   | ", "\n    ", "                                                                    | ", "\n    ", "                                  | ", "\n    ", "                   | ", "\n    ", "                  | ", "\n    ", "                   | ", "\n    ", "                                  | ", "\n    ", "                                  | ", "\n    ", "                                  | ", "\n    ", "                 | ", "\n    ", "  | ", "\n    ", " | ", "\n    ", "  | ", "\n    ", "                                                | ", "\n    ", "                                             | ", "\n  "], ["\n    options                                                                                 | expected\n    ", "                                                                            | ", "\n    ", "                                                       | ", "\n    ", "                                                                    | ", "\n    ", "                                                                   | ", "\n    ", "                                                                    | ", "\n    ", "                                  | ", "\n    ", "                   | ", "\n    ", "                  | ", "\n    ", "                   | ", "\n    ", "                                  | ", "\n    ", "                                  | ", "\n    ", "                                  | ", "\n    ", "                 | ", "\n    ", "  | ", "\n    ", " | ", "\n    ", "  | ", "\n    ", "                                                | ", "\n    ", "                                             | ", "\n  "])), undefined, { map: { accept: 'application/json, text/plain, */*' } }, { propKey: 'some prop value' }, { map: { accept: 'application/json, text/plain, */*' } }, { method: 'GET' }, { map: { accept: 'application/json, text/plain, */*' } }, { method: 'POST' }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { method: 'PUT' }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { headers: { 'content-type': 'application/json' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { method: 'GET', headers: { 'content-type': 'application/json' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { method: 'POST', headers: { 'content-type': 'application/json' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { method: 'PUT', headers: { 'content-type': 'application/json' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { headers: { 'cOnTent-tYpe': 'application/json' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/json' } }, { headers: { 'content-type': 'AppLiCatIon/JsOn' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'AppLiCatIon/JsOn' } }, { headers: { 'cOnTent-tYpe': 'AppLiCatIon/JsOn' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'AppLiCatIon/JsOn' } }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/x-www-form-urlencoded' } }, { method: 'GET', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/x-www-form-urlencoded' } }, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/x-www-form-urlencoded' } }, { method: 'PUT', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, { map: { accept: 'application/json, text/plain, */*', 'content-type': 'application/x-www-form-urlencoded' } }, { headers: { Accept: 'text/plain' } }, { map: { accept: 'text/plain' } }, { headers: { Auth: 'Basic asdasdasd' } }, { map: { accept: 'application/json, text/plain, */*', auth: 'Basic asdasdasd' } })("when called with options: '$options' then the result should be '$expected'", function (_a) {
        var options = _a.options, expected = _a.expected;
        expect(parseHeaders(options)).toEqual(expected);
    });
});
describe('isContentTypeApplicationJson', function () {
    it.each(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    headers                                                                 | expected\n    ", "                                                            | ", "\n    ", "                  | ", "\n    ", "                  | ", "\n    ", "                  | ", "\n    ", " | ", "\n    ", "                    | ", "\n  "], ["\n    headers                                                                 | expected\n    ", "                                                            | ", "\n    ", "                  | ", "\n    ", "                  | ", "\n    ", "                  | ", "\n    ", " | ", "\n    ", "                    | ", "\n  "])), undefined, false, new Headers({ 'cOnTent-tYpe': 'application/json' }), true, new Headers({ 'content-type': 'AppLiCatIon/JsOn' }), true, new Headers({ 'cOnTent-tYpe': 'AppLiCatIon/JsOn' }), true, new Headers({ 'content-type': 'application/x-www-form-urlencoded' }), false, new Headers({ auth: 'Basic akdjasdkjalksdjasd' }), false)("when called with headers: 'headers' then the result should be '$expected'", function (_a) {
        var headers = _a.headers, expected = _a.expected;
        expect(isContentTypeApplicationJson(headers)).toEqual(expected);
    });
});
describe('parseBody', function () {
    it.each(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    options                  | isAppJson | expected\n    ", "             | ", "  | ", "\n    ", "             | ", "   | ", "\n    ", "   | ", "  | ", "\n    ", "   | ", "   | ", "\n    ", " | ", "  | ", "\n    ", " | ", "   | ", "\n    ", " | ", "  | ", "\n    ", " | ", "   | ", "\n  "], ["\n    options                  | isAppJson | expected\n    ", "             | ", "  | ", "\n    ", "             | ", "   | ", "\n    ", "   | ", "  | ", "\n    ", "   | ", "   | ", "\n    ", " | ", "  | ", "\n    ", " | ", "   | ", "\n    ", " | ", "  | ", "\n    ", " | ", "   | ", "\n  "])), undefined, false, undefined, undefined, true, undefined, { data: undefined }, false, undefined, { data: undefined }, true, undefined, { data: 'some data' }, false, 'some data', { data: 'some data' }, true, 'some data', { data: { id: '0' } }, false, new URLSearchParams({ id: '0' }), { data: { id: '0' } }, true, '{"id":"0"}')("when called with options: '$options' and isAppJson: '$isAppJson' then the result should be '$expected'", function (_a) {
        var options = _a.options, isAppJson = _a.isAppJson, expected = _a.expected;
        expect(parseBody(options, isAppJson)).toEqual(expected);
    });
});
describe('parseCredentials', function () {
    it.each(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    options                                                   | expected\n    ", "                                              | ", "\n    ", "                                                     | ", "\n    ", "                             | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "      | ", "\n    ", "                             | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "      | ", "\n    ", "                                | ", "\n    ", "    | ", "\n    ", "        | ", "\n    ", "         | ", "\n  "], ["\n    options                                                   | expected\n    ", "                                              | ", "\n    ", "                                                     | ", "\n    ", "                             | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "      | ", "\n    ", "                             | ", "\n    ", " | ", "\n    ", "     | ", "\n    ", "      | ", "\n    ", "                                | ", "\n    ", "    | ", "\n    ", "        | ", "\n    ", "         | ", "\n  "])), undefined, undefined, {}, 'same-origin', { credentials: undefined }, 'same-origin', { credentials: undefined, withCredentials: undefined }, 'same-origin', { credentials: undefined, withCredentials: false }, 'same-origin', { credentials: undefined, withCredentials: true }, 'include', { credentials: 'invalid' }, 'invalid', { credentials: 'invalid', withCredentials: undefined }, 'invalid', { credentials: 'invalid', withCredentials: false }, 'invalid', { credentials: 'invalid', withCredentials: true }, 'invalid', { credentials: 'omit' }, 'omit', { credentials: 'omit', withCredentials: undefined }, 'omit', { credentials: 'omit', withCredentials: false }, 'omit', { credentials: 'omit', withCredentials: true }, 'omit')("when called with options: '$options' then the result should be '$expected'", function (_a) {
        var options = _a.options, isAppJson = _a.isAppJson, expected = _a.expected;
        expect(parseCredentials(options)).toEqual(expected);
    });
});
describe('parseResponseBody', function () {
    var rsp = {};
    it('parses json', function () { return __awaiter(void 0, void 0, void 0, function () {
        var value, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    value = { hello: 'world' };
                    return [4 /*yield*/, parseResponseBody(__assign(__assign({}, rsp), { json: jest.fn().mockImplementationOnce(function () { return value; }) }), 'json')];
                case 1:
                    body = _a.sent();
                    expect(body).toEqual(value);
                    return [2 /*return*/];
            }
        });
    }); });
    it('parses text', function () { return __awaiter(void 0, void 0, void 0, function () {
        var value, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    value = 'RAW TEXT';
                    return [4 /*yield*/, parseResponseBody(__assign(__assign({}, rsp), { text: jest.fn().mockImplementationOnce(function () { return value; }) }), 'text')];
                case 1:
                    body = _a.sent();
                    expect(body).toEqual(value);
                    return [2 /*return*/];
            }
        });
    }); });
    it('undefined text', function () { return __awaiter(void 0, void 0, void 0, function () {
        var value, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    value = 'RAW TEXT';
                    return [4 /*yield*/, parseResponseBody(__assign(__assign({}, rsp), { text: jest.fn().mockImplementationOnce(function () { return value; }) }))];
                case 1:
                    body = _a.sent();
                    expect(body).toEqual(value);
                    return [2 /*return*/];
            }
        });
    }); });
    it('undefined as parsed json', function () { return __awaiter(void 0, void 0, void 0, function () {
        var value, body;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    value = { hello: 'world' };
                    return [4 /*yield*/, parseResponseBody(__assign(__assign({}, rsp), { text: jest.fn().mockImplementationOnce(function () { return JSON.stringify(value); }) }))];
                case 1:
                    body = _a.sent();
                    expect(body).toEqual(value);
                    return [2 /*return*/];
            }
        });
    }); });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=fetch.test.js.map