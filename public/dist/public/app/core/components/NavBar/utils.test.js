import { __makeTemplateObject } from "tslib";
import { updateConfig } from '../../config';
import { getForcedLoginUrl, isLinkActive, isSearchActive } from './utils';
describe('getForcedLoginUrl', function () {
    it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    appSubUrl          | url                    | expected\n    ", "              | ", " | ", "\n    ", "      | ", " | ", "\n    ", " | ", " | ", "\n    ", "      | ", "                  | ", "\n    ", "      | ", "         | ", "\n    ", "      | ", "        | ", "\n  "], ["\n    appSubUrl          | url                    | expected\n    ", "              | ", " | ", "\n    ", "      | ", " | ", "\n    ", " | ", " | ", "\n    ", "      | ", "                  | ", "\n    ", "      | ", "         | ", "\n    ", "      | ", "        | ", "\n  "])), '', '/whatever?a=1&b=2', '/whatever?a=1&b=2&forceLogin=true', '/grafana', '/whatever?a=1&b=2', '/grafana/whatever?a=1&b=2&forceLogin=true', '/grafana/test', '/whatever?a=1&b=2', '/grafana/test/whatever?a=1&b=2&forceLogin=true', '/grafana', '', '/grafana?forceLogin=true', '/grafana', '/whatever', '/grafana/whatever?forceLogin=true', '/grafana', '/whatever/', '/grafana/whatever/?forceLogin=true')("when appUrl set to '$appUrl' and appSubUrl set to '$appSubUrl' then result should be '$expected'", function (_a) {
        var appSubUrl = _a.appSubUrl, url = _a.url, expected = _a.expected;
        updateConfig({
            appSubUrl: appSubUrl,
        });
        var result = getForcedLoginUrl(url);
        expect(result).toBe(expected);
    });
});
describe('isLinkActive', function () {
    it('returns true if the link url matches the pathname', function () {
        var mockPathName = '/test';
        var mockLink = {
            text: 'Test',
            url: '/test',
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });
    it('returns true if the pathname starts with the link url', function () {
        var mockPathName = '/test/edit';
        var mockLink = {
            text: 'Test',
            url: '/test',
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });
    it('returns true if a child link url matches the pathname', function () {
        var mockPathName = '/testChild2';
        var mockLink = {
            text: 'Test',
            url: '/test',
            children: [
                {
                    text: 'TestChild',
                    url: '/testChild',
                },
                {
                    text: 'TestChild2',
                    url: '/testChild2',
                },
            ],
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });
    it('returns true if the pathname starts with a child link url', function () {
        var mockPathName = '/testChild2/edit';
        var mockLink = {
            text: 'Test',
            url: '/test',
            children: [
                {
                    text: 'TestChild',
                    url: '/testChild',
                },
                {
                    text: 'TestChild2',
                    url: '/testChild2',
                },
            ],
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(true);
    });
    it('returns false if none of the link urls match the pathname', function () {
        var mockPathName = '/somethingWeird';
        var mockLink = {
            text: 'Test',
            url: '/test',
            children: [
                {
                    text: 'TestChild',
                    url: '/testChild',
                },
                {
                    text: 'TestChild2',
                    url: '/testChild2',
                },
            ],
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(false);
    });
    it('returns false for the base route if the pathname is not an exact match', function () {
        var mockPathName = '/foo';
        var mockLink = {
            text: 'Test',
            url: '/',
            children: [
                {
                    text: 'TestChild',
                    url: '/',
                },
                {
                    text: 'TestChild2',
                    url: '/testChild2',
                },
            ],
        };
        expect(isLinkActive(mockPathName, mockLink)).toBe(false);
    });
});
describe('isSearchActive', function () {
    it('returns true if the search query parameter is "open"', function () {
        var mockLocation = {
            hash: '',
            pathname: '/',
            search: '?search=open',
            state: '',
        };
        expect(isSearchActive(mockLocation)).toBe(true);
    });
    it('returns false if the search query parameter is missing', function () {
        var mockLocation = {
            hash: '',
            pathname: '/',
            search: '',
            state: '',
        };
        expect(isSearchActive(mockLocation)).toBe(false);
    });
});
var templateObject_1;
//# sourceMappingURL=utils.test.js.map