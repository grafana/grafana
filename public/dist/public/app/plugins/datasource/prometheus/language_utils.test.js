import { __assign } from "tslib";
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector, expandRecordingRules, fixSummariesMetadata, parseSelector, } from './language_utils';
describe('parseSelector()', function () {
    var parsed;
    it('returns a clean selector from an empty selector', function () {
        parsed = parseSelector('{}', 1);
        expect(parsed.selector).toBe('{}');
        expect(parsed.labelKeys).toEqual([]);
    });
    it('returns a clean selector from an unclosed selector', function () {
        var parsed = parseSelector('{foo');
        expect(parsed.selector).toBe('{}');
    });
    it('returns the selector sorted by label key', function () {
        parsed = parseSelector('{foo="bar"}');
        expect(parsed.selector).toBe('{foo="bar"}');
        expect(parsed.labelKeys).toEqual(['foo']);
        parsed = parseSelector('{foo="bar",baz="xx"}');
        expect(parsed.selector).toBe('{baz="xx",foo="bar"}');
    });
    it('returns a clean selector from an incomplete one', function () {
        parsed = parseSelector('{foo}');
        expect(parsed.selector).toBe('{}');
        parsed = parseSelector('{foo="bar",baz}');
        expect(parsed.selector).toBe('{foo="bar"}');
        parsed = parseSelector('{foo="bar",baz="}');
        expect(parsed.selector).toBe('{foo="bar"}');
        // Cursor in value area counts as incomplete
        parsed = parseSelector('{foo="bar",baz=""}', 16);
        expect(parsed.selector).toBe('{foo="bar"}');
        parsed = parseSelector('{foo="bar",baz="4"}', 17);
        expect(parsed.selector).toBe('{foo="bar"}');
    });
    it('throws if not inside a selector', function () {
        expect(function () { return parseSelector('foo{}', 0); }).toThrow();
        expect(function () { return parseSelector('foo{} + bar{}', 5); }).toThrow();
    });
    it('returns the selector nearest to the cursor offset', function () {
        expect(function () { return parseSelector('{foo="bar"} + {foo="bar"}', 0); }).toThrow();
        parsed = parseSelector('{foo="bar"} + {foo="bar"}', 1);
        expect(parsed.selector).toBe('{foo="bar"}');
        parsed = parseSelector('{foo="bar"} + {baz="xx"}', 1);
        expect(parsed.selector).toBe('{foo="bar"}');
        parsed = parseSelector('{baz="xx"} + {foo="bar"}', 16);
        expect(parsed.selector).toBe('{foo="bar"}');
    });
    it('returns a selector with metric if metric is given', function () {
        parsed = parseSelector('bar{foo}', 4);
        expect(parsed.selector).toBe('{__name__="bar"}');
        parsed = parseSelector('baz{foo="bar"}', 13);
        expect(parsed.selector).toBe('{__name__="baz",foo="bar"}');
        parsed = parseSelector('bar:metric:1m{}', 14);
        expect(parsed.selector).toBe('{__name__="bar:metric:1m"}');
    });
});
describe('fixSummariesMetadata', function () {
    var synthetics = {
        ALERTS: {
            type: 'counter',
            help: 'Time series showing pending and firing alerts. The sample value is set to 1 as long as the alert is in the indicated active (pending or firing) state.',
        },
    };
    it('returns only synthetics on empty metadata', function () {
        expect(fixSummariesMetadata({})).toEqual(__assign({}, synthetics));
    });
    it('returns unchanged metadata if no summary is present', function () {
        var metadataRaw = {
            foo: [{ type: 'not_a_summary', help: 'foo help' }],
        };
        var metadata = {
            foo: { type: 'not_a_summary', help: 'foo help' },
        };
        expect(fixSummariesMetadata(metadataRaw)).toEqual(__assign(__assign({}, metadata), synthetics));
    });
    it('returns metadata with added count and sum for a summary', function () {
        var metadata = {
            foo: [{ type: 'not_a_summary', help: 'foo help' }],
            bar: [{ type: 'summary', help: 'bar help' }],
        };
        var expected = {
            foo: { type: 'not_a_summary', help: 'foo help' },
            bar: { type: 'summary', help: 'bar help' },
            bar_count: { type: 'counter', help: 'Count of events that have been observed for the base metric (bar help)' },
            bar_sum: { type: 'counter', help: 'Total sum of all observed values for the base metric (bar help)' },
        };
        expect(fixSummariesMetadata(metadata)).toEqual(__assign(__assign({}, expected), synthetics));
    });
    it('returns metadata with added bucket/count/sum for a histogram', function () {
        var metadata = {
            foo: [{ type: 'not_a_histogram', help: 'foo help' }],
            bar: [{ type: 'histogram', help: 'bar help' }],
        };
        var expected = {
            foo: { type: 'not_a_histogram', help: 'foo help' },
            bar: { type: 'histogram', help: 'bar help' },
            bar_bucket: { type: 'counter', help: 'Cumulative counters for the observation buckets (bar help)' },
            bar_count: {
                type: 'counter',
                help: 'Count of events that have been observed for the histogram metric (bar help)',
            },
            bar_sum: { type: 'counter', help: 'Total sum of all observed values for the histogram metric (bar help)' },
        };
        expect(fixSummariesMetadata(metadata)).toEqual(__assign(__assign({}, expected), synthetics));
    });
});
describe('expandRecordingRules()', function () {
    it('returns query w/o recording rules as is', function () {
        expect(expandRecordingRules('metric', {})).toBe('metric');
        expect(expandRecordingRules('metric + metric', {})).toBe('metric + metric');
        expect(expandRecordingRules('metric{}', {})).toBe('metric{}');
    });
    it('does not modify recording rules name in label values', function () {
        expect(expandRecordingRules('{__name__="metric"} + bar', { metric: 'foo', bar: 'super' })).toBe('{__name__="metric"} + super');
    });
    it('returns query with expanded recording rules', function () {
        expect(expandRecordingRules('metric', { metric: 'foo' })).toBe('foo');
        expect(expandRecordingRules('metric + metric', { metric: 'foo' })).toBe('foo + foo');
        expect(expandRecordingRules('metric{}', { metric: 'foo' })).toBe('foo{}');
        expect(expandRecordingRules('metric[]', { metric: 'foo' })).toBe('foo[]');
        expect(expandRecordingRules('metric + foo', { metric: 'foo', foo: 'bar' })).toBe('foo + bar');
    });
    it('returns query with labels with expanded recording rules', function () {
        expect(expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', { metricA: 'fooA', metricB: 'fooB' })).toBe('fooA{label1="value1"} / fooB{label2="value2"}');
        expect(expandRecordingRules('metricA{label1="value1",label2="value,2"}', {
            metricA: 'rate(fooA[])',
        })).toBe('rate(fooA{label1="value1",label2="value,2"}[])');
        expect(expandRecordingRules('metricA{label1="value1"} / metricB{label2="value2"}', {
            metricA: 'rate(fooA[])',
            metricB: 'rate(fooB[])',
        })).toBe('rate(fooA{label1="value1"}[])/ rate(fooB{label2="value2"}[])');
        expect(expandRecordingRules('metricA{label1="value1",label2="value2"} / metricB{label3="value3"}', {
            metricA: 'rate(fooA[])',
            metricB: 'rate(fooB[])',
        })).toBe('rate(fooA{label1="value1",label2="value2"}[])/ rate(fooB{label3="value3"}[])');
    });
});
describe('escapeLabelValueInExactSelector()', function () {
    it('handles newline characters', function () {
        expect(escapeLabelValueInExactSelector('t\nes\nt')).toBe('t\\nes\\nt');
    });
    it('handles backslash characters', function () {
        expect(escapeLabelValueInExactSelector('t\\es\\t')).toBe('t\\\\es\\\\t');
    });
    it('handles double-quote characters', function () {
        expect(escapeLabelValueInExactSelector('t"es"t')).toBe('t\\"es\\"t');
    });
    it('handles all together', function () {
        expect(escapeLabelValueInExactSelector('t\\e"st\nl\nab"e\\l')).toBe('t\\\\e\\"st\\nl\\nab\\"e\\\\l');
    });
});
describe('escapeLabelValueInRegexSelector()', function () {
    it('handles newline characters', function () {
        expect(escapeLabelValueInRegexSelector('t\nes\nt')).toBe('t\\nes\\nt');
    });
    it('handles backslash characters', function () {
        expect(escapeLabelValueInRegexSelector('t\\es\\t')).toBe('t\\\\\\\\es\\\\\\\\t');
    });
    it('handles double-quote characters', function () {
        expect(escapeLabelValueInRegexSelector('t"es"t')).toBe('t\\"es\\"t');
    });
    it('handles regex-meaningful characters', function () {
        expect(escapeLabelValueInRegexSelector('t+es$t')).toBe('t\\\\+es\\\\$t');
    });
    it('handles all together', function () {
        expect(escapeLabelValueInRegexSelector('t\\e"s+t\nl\n$ab"e\\l')).toBe('t\\\\\\\\e\\"s\\\\+t\\nl\\n\\\\$ab\\"e\\\\\\\\l');
    });
});
//# sourceMappingURL=language_utils.test.js.map