import { groupMetricsByPrefix, RECORDING_RULES_GROUP } from './PromQueryField';
describe('groupMetricsByPrefix()', function () {
    it('returns an empty group for no metrics', function () {
        expect(groupMetricsByPrefix([])).toEqual([]);
    });
    it('returns options grouped by prefix', function () {
        expect(groupMetricsByPrefix(['foo_metric'])).toMatchObject([
            {
                value: 'foo',
                children: [
                    {
                        value: 'foo_metric',
                    },
                ],
            },
        ]);
    });
    it('returns options without prefix as toplevel option', function () {
        expect(groupMetricsByPrefix(['metric'])).toMatchObject([
            {
                value: 'metric',
            },
        ]);
    });
    it('returns recording rules grouped separately', function () {
        expect(groupMetricsByPrefix([':foo_metric:'])).toMatchObject([
            {
                value: RECORDING_RULES_GROUP,
                children: [
                    {
                        value: ':foo_metric:',
                    },
                ],
            },
        ]);
    });
});
//# sourceMappingURL=PromQueryField.test.js.map