import { DataProcessor } from '../data_processor';
import { getProcessedDataFrames } from 'app/features/query/state/runRequest';
describe('Graph DataProcessor', function () {
    var panel = {
        xaxis: { mode: 'series' },
        aliasColors: {},
    };
    var processor = new DataProcessor(panel);
    describe('getTimeSeries from LegacyResponseData', function () {
        // Try each type of data
        var dataList = getProcessedDataFrames([
            {
                alias: 'First (time_series)',
                datapoints: [
                    [1, 1001],
                    [2, 1002],
                    [3, 1003],
                ],
                unit: 'watt',
            },
            {
                name: 'table_data',
                columns: [
                    { text: 'time' },
                    { text: 'v1', unit: 'ohm' },
                    { text: 'v2' },
                    { text: 'string' }, // skipped
                ],
                rows: [
                    [1001, 0.1, 1.1, 'a'],
                    [1002, 0.2, 2.2, 'b'],
                    [1003, 0.3, 3.3, 'c'], // c
                ],
            },
            {
                name: 'series',
                fields: [
                    { name: 'v1', values: [0.1, 0.2, 0.3] },
                    { name: 'v2', values: [1.1, 2.2, 3.3] },
                    { name: 'string', values: ['a', 'b', 'c'] },
                    { name: 'time', values: [1001, 1002, 1003] }, // Time is last column
                ],
            },
            {
                name: 'series with time as strings',
                fields: [
                    { name: 'v1', values: [0.1, 0.2, 0.3] },
                    {
                        name: 'time',
                        values: ['2021-01-01T01:00:00.000Z', 'Fri, 01 Jan 2021 01:00:00 GMT', '2021-01-01T02:00:00.000Z'], // Time is last column
                    },
                ],
            },
        ]);
        it('Should return a new series for each field', function () {
            panel.xaxis.mode = 'series';
            var series = processor.getSeriesList({ dataList: dataList });
            expect(series.length).toEqual(6);
            expect(series).toMatchSnapshot();
        });
        it('Should return single histogram', function () {
            panel.xaxis.mode = 'histogram';
            var series = processor.getSeriesList({ dataList: dataList });
            expect(series.length).toEqual(1);
            expect(series).toMatchSnapshot();
        });
    });
});
//# sourceMappingURL=data_processor.test.js.map