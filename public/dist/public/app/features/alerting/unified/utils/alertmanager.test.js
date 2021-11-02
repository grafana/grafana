import { parseMatcher, parseMatchers, stringifyMatcher, labelsMatchMatchers } from './alertmanager';
describe('Alertmanager utils', function () {
    describe('parseMatcher', function () {
        it('should parse operators correctly', function () {
            expect(parseMatcher('foo=bar')).toEqual({
                name: 'foo',
                value: 'bar',
                isRegex: false,
                isEqual: true,
            });
            expect(parseMatcher('foo!=bar')).toEqual({
                name: 'foo',
                value: 'bar',
                isRegex: false,
                isEqual: false,
            });
            expect(parseMatcher('foo =~bar')).toEqual({
                name: 'foo',
                value: 'bar',
                isRegex: true,
                isEqual: true,
            });
            expect(parseMatcher('foo!~ bar')).toEqual({
                name: 'foo',
                value: 'bar',
                isRegex: true,
                isEqual: false,
            });
        });
        it('should parse escaped values correctly', function () {
            expect(parseMatcher('foo=~"bar\\"baz\\""')).toEqual({
                name: 'foo',
                value: 'bar"baz"',
                isRegex: true,
                isEqual: true,
            });
            expect(parseMatcher('foo=~bar\\"baz\\"')).toEqual({
                name: 'foo',
                value: 'bar"baz"',
                isRegex: true,
                isEqual: true,
            });
        });
        it('should parse multiple operators values correctly', function () {
            expect(parseMatcher('foo=~bar=baz!=bad!~br')).toEqual({
                name: 'foo',
                value: 'bar=baz!=bad!~br',
                isRegex: true,
                isEqual: true,
            });
        });
    });
    describe('stringifyMatcher', function () {
        it('should stringify matcher correctly', function () {
            expect(stringifyMatcher({
                name: 'foo',
                value: 'boo="bar"',
                isRegex: true,
                isEqual: false,
            })).toEqual('foo!~"boo=\\"bar\\""');
        });
    });
    describe('parseMatchers', function () {
        it('should parse all operators', function () {
            expect(parseMatchers('foo=bar, bar=~ba.+, severity!=warning, email!~@grafana.com')).toEqual([
                { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
                { name: 'bar', value: 'ba.+', isEqual: true, isRegex: true },
                { name: 'severity', value: 'warning', isRegex: false, isEqual: false },
                { name: 'email', value: '@grafana.com', isRegex: true, isEqual: false },
            ]);
        });
        it('should return nothing for invalid operator', function () {
            expect(parseMatchers('foo=!bar')).toEqual([]);
        });
        it('should parse matchers with or without quotes', function () {
            expect(parseMatchers('foo="bar",bar=bazz')).toEqual([
                { name: 'foo', value: 'bar', isRegex: false, isEqual: true },
                { name: 'bar', value: 'bazz', isEqual: true, isRegex: false },
            ]);
        });
    });
    describe('labelsMatchMatchers', function () {
        it('should return true for matching labels', function () {
            var labels = {
                foo: 'bar',
                bar: 'bazz',
                bazz: 'buzz',
            };
            var matchers = parseMatchers('foo=bar,bar=bazz');
            expect(labelsMatchMatchers(labels, matchers)).toBe(true);
        });
        it('should return false for no matching labels', function () {
            var labels = {
                foo: 'bar',
                bar: 'bazz',
            };
            var matchers = parseMatchers('foo=buzz');
            expect(labelsMatchMatchers(labels, matchers)).toBe(false);
        });
        it('should match with different operators', function () {
            var labels = {
                foo: 'bar',
                bar: 'bazz',
                email: 'admin@grafana.com',
            };
            var matchers = parseMatchers('foo!=bazz,bar=~ba.+');
            expect(labelsMatchMatchers(labels, matchers)).toBe(true);
        });
    });
});
//# sourceMappingURL=alertmanager.test.js.map