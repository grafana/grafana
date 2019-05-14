import { calculateFieldStats, calculateLogsLabelStats, dedupLogRows, getParser, LogsDedupStrategy, LogsParsers, } from '../logs_model';
describe('dedupLogRows()', function () {
    test('should return rows as is when dedup is set to none', function () {
        var logs = {
            rows: [
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
            ],
        };
        expect(dedupLogRows(logs, LogsDedupStrategy.none).rows).toMatchObject(logs.rows);
    });
    test('should dedup on exact matches', function () {
        var logs = {
            rows: [
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
                {
                    entry: 'INFO test 2.44 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
            ],
        };
        expect(dedupLogRows(logs, LogsDedupStrategy.exact).rows).toEqual([
            {
                duplicates: 1,
                entry: 'WARN test 1.23 on [xxx]',
            },
            {
                duplicates: 0,
                entry: 'INFO test 2.44 on [xxx]',
            },
            {
                duplicates: 0,
                entry: 'WARN test 1.23 on [xxx]',
            },
        ]);
    });
    test('should dedup on number matches', function () {
        var logs = {
            rows: [
                {
                    entry: 'WARN test 1.2323423 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
                {
                    entry: 'INFO test 2.44 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
            ],
        };
        expect(dedupLogRows(logs, LogsDedupStrategy.numbers).rows).toEqual([
            {
                duplicates: 1,
                entry: 'WARN test 1.2323423 on [xxx]',
            },
            {
                duplicates: 0,
                entry: 'INFO test 2.44 on [xxx]',
            },
            {
                duplicates: 0,
                entry: 'WARN test 1.23 on [xxx]',
            },
        ]);
    });
    test('should dedup on signature matches', function () {
        var logs = {
            rows: [
                {
                    entry: 'WARN test 1.2323423 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
                {
                    entry: 'INFO test 2.44 on [xxx]',
                },
                {
                    entry: 'WARN test 1.23 on [xxx]',
                },
            ],
        };
        expect(dedupLogRows(logs, LogsDedupStrategy.signature).rows).toEqual([
            {
                duplicates: 3,
                entry: 'WARN test 1.2323423 on [xxx]',
            },
        ]);
    });
    test('should return to non-deduped state on same log result', function () {
        var logs = {
            rows: [
                {
                    entry: 'INFO 123',
                },
                {
                    entry: 'WARN 123',
                },
                {
                    entry: 'WARN 123',
                },
            ],
        };
        expect(dedupLogRows(logs, LogsDedupStrategy.exact).rows).toEqual([
            {
                duplicates: 0,
                entry: 'INFO 123',
            },
            {
                duplicates: 1,
                entry: 'WARN 123',
            },
        ]);
        expect(dedupLogRows(logs, LogsDedupStrategy.none).rows).toEqual(logs.rows);
    });
});
describe('calculateFieldStats()', function () {
    test('should return no stats for empty rows', function () {
        expect(calculateFieldStats([], /foo=(.*)/)).toEqual([]);
    });
    test('should return no stats if extractor does not match', function () {
        var rows = [
            {
                entry: 'foo=bar',
            },
        ];
        expect(calculateFieldStats(rows, /baz=(.*)/)).toEqual([]);
    });
    test('should return stats for found field', function () {
        var rows = [
            {
                entry: 'foo="42 + 1"',
            },
            {
                entry: 'foo=503 baz=foo',
            },
            {
                entry: 'foo="42 + 1"',
            },
            {
                entry: 't=2018-12-05T07:44:59+0000 foo=503',
            },
        ];
        expect(calculateFieldStats(rows, /foo=("[^"]*"|\S+)/)).toMatchObject([
            {
                value: '"42 + 1"',
                count: 2,
            },
            {
                value: '503',
                count: 2,
            },
        ]);
    });
});
describe('calculateLogsLabelStats()', function () {
    test('should return no stats for empty rows', function () {
        expect(calculateLogsLabelStats([], '')).toEqual([]);
    });
    test('should return no stats of label is not found', function () {
        var rows = [
            {
                entry: 'foo 1',
                labels: {
                    foo: 'bar',
                },
            },
        ];
        expect(calculateLogsLabelStats(rows, 'baz')).toEqual([]);
    });
    test('should return stats for found labels', function () {
        var rows = [
            {
                entry: 'foo 1',
                labels: {
                    foo: 'bar',
                },
            },
            {
                entry: 'foo 0',
                labels: {
                    foo: 'xxx',
                },
            },
            {
                entry: 'foo 2',
                labels: {
                    foo: 'bar',
                },
            },
        ];
        expect(calculateLogsLabelStats(rows, 'foo')).toMatchObject([
            {
                value: 'bar',
                count: 2,
            },
            {
                value: 'xxx',
                count: 1,
            },
        ]);
    });
});
describe('getParser()', function () {
    test('should return no parser on empty line', function () {
        expect(getParser('')).toBeUndefined();
    });
    test('should return no parser on unknown line pattern', function () {
        expect(getParser('To Be or not to be')).toBeUndefined();
    });
    test('should return logfmt parser on key value patterns', function () {
        expect(getParser('foo=bar baz="41 + 1')).toEqual(LogsParsers.logfmt);
    });
    test('should return JSON parser on JSON log lines', function () {
        // TODO implement other JSON value types than string
        expect(getParser('{"foo": "bar", "baz": "41 + 1"}')).toEqual(LogsParsers.JSON);
    });
});
describe('LogsParsers', function () {
    describe('logfmt', function () {
        var parser = LogsParsers.logfmt;
        test('should detect format', function () {
            expect(parser.test('foo')).toBeFalsy();
            expect(parser.test('foo=bar')).toBeTruthy();
        });
        test('should return parsed fields', function () {
            expect(parser.getFields('foo=bar baz="42 + 1"')).toEqual(['foo=bar', 'baz="42 + 1"']);
        });
        test('should return label for field', function () {
            expect(parser.getLabelFromField('foo=bar')).toBe('foo');
        });
        test('should return value for field', function () {
            expect(parser.getValueFromField('foo=bar')).toBe('bar');
        });
        test('should build a valid value matcher', function () {
            var matcher = parser.buildMatcher('foo');
            var match = 'foo=bar'.match(matcher);
            expect(match).toBeDefined();
            expect(match[1]).toBe('bar');
        });
    });
    describe('JSON', function () {
        var parser = LogsParsers.JSON;
        test('should detect format', function () {
            expect(parser.test('foo')).toBeFalsy();
            expect(parser.test('{"foo":"bar"}')).toBeTruthy();
        });
        test('should return parsed fields', function () {
            expect(parser.getFields('{ "foo" : "bar", "baz" : 42 }')).toEqual(['"foo" : "bar"', '"baz" : 42']);
        });
        test('should return parsed fields for nested quotes', function () {
            expect(parser.getFields("{\"foo\":\"bar: '[value=\\\"42\\\"]'\"}")).toEqual(["\"foo\":\"bar: '[value=\\\"42\\\"]'\""]);
        });
        test('should return label for field', function () {
            expect(parser.getLabelFromField('"foo" : "bar"')).toBe('foo');
        });
        test('should return value for field', function () {
            expect(parser.getValueFromField('"foo" : "bar"')).toBe('"bar"');
            expect(parser.getValueFromField('"foo" : 42')).toBe('42');
            expect(parser.getValueFromField('"foo" : 42.1')).toBe('42.1');
        });
        test('should build a valid value matcher for strings', function () {
            var matcher = parser.buildMatcher('foo');
            var match = '{"foo":"bar"}'.match(matcher);
            expect(match).toBeDefined();
            expect(match[1]).toBe('bar');
        });
        test('should build a valid value matcher for integers', function () {
            var matcher = parser.buildMatcher('foo');
            var match = '{"foo":42.1}'.match(matcher);
            expect(match).toBeDefined();
            expect(match[1]).toBe('42.1');
        });
    });
});
//# sourceMappingURL=logs_model.test.js.map