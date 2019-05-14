import { transformers, transformDataToTable } from '../transformers';
describe('when transforming time series table', function () {
    var table;
    describe('given 2 time series', function () {
        var time = new Date().getTime();
        var timeSeries = [
            {
                target: 'series1',
                datapoints: [[12.12, time], [14.44, time + 1]],
            },
            {
                target: 'series2',
                datapoints: [[16.12, time]],
            },
        ];
        describe('timeseries_to_rows', function () {
            var panel = {
                transform: 'timeseries_to_rows',
                sort: { col: 0, desc: true },
            };
            beforeEach(function () {
                table = transformDataToTable(timeSeries, panel);
            });
            it('should return 3 rows', function () {
                expect(table.rows.length).toBe(3);
                expect(table.rows[0][1]).toBe('series1');
                expect(table.rows[1][1]).toBe('series1');
                expect(table.rows[2][1]).toBe('series2');
                expect(table.rows[0][2]).toBe(12.12);
            });
            it('should return 3 rows', function () {
                expect(table.columns.length).toBe(3);
                expect(table.columns[0].text).toBe('Time');
                expect(table.columns[1].text).toBe('Metric');
                expect(table.columns[2].text).toBe('Value');
            });
        });
        describe('timeseries_to_columns', function () {
            var panel = {
                transform: 'timeseries_to_columns',
            };
            beforeEach(function () {
                table = transformDataToTable(timeSeries, panel);
            });
            it('should return 3 columns', function () {
                expect(table.columns.length).toBe(3);
                expect(table.columns[0].text).toBe('Time');
                expect(table.columns[1].text).toBe('series1');
                expect(table.columns[2].text).toBe('series2');
            });
            it('should return 2 rows', function () {
                expect(table.rows.length).toBe(2);
                expect(table.rows[0][1]).toBe(12.12);
                expect(table.rows[0][2]).toBe(16.12);
            });
            it('should be undefined when no value for timestamp', function () {
                expect(table.rows[1][2]).toBe(undefined);
            });
        });
        describe('timeseries_aggregations', function () {
            var panel = {
                transform: 'timeseries_aggregations',
                sort: { col: 0, desc: true },
                columns: [{ text: 'Max', value: 'max' }, { text: 'Min', value: 'min' }],
            };
            beforeEach(function () {
                table = transformDataToTable(timeSeries, panel);
            });
            it('should return 2 rows', function () {
                expect(table.rows.length).toBe(2);
                expect(table.rows[0][0]).toBe('series1');
                expect(table.rows[0][1]).toBe(14.44);
                expect(table.rows[0][2]).toBe(12.12);
            });
            it('should return 2 columns', function () {
                expect(table.columns.length).toBe(3);
                expect(table.columns[0].text).toBe('Metric');
                expect(table.columns[1].text).toBe('Max');
                expect(table.columns[2].text).toBe('Min');
            });
        });
    });
    describe('table data sets', function () {
        describe('Table', function () {
            var transform = 'table';
            var panel = {
                transform: transform,
            };
            var time = new Date().getTime();
            var nonTableData = [
                {
                    type: 'foo',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Value' }],
                    rows: [[time, 'Label Value 1', 42]],
                },
            ];
            var singleQueryData = [
                {
                    type: 'table',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Value' }],
                    rows: [[time, 'Label Value 1', 42]],
                },
            ];
            var multipleQueriesDataSameLabels = [
                {
                    type: 'table',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #A' }],
                    rows: [[time, 'Label Value 1', 'Label Value 2', 42]],
                },
                {
                    type: 'table',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #B' }],
                    rows: [[time, 'Label Value 1', 'Label Value 2', 13]],
                },
                {
                    type: 'table',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #C' }],
                    rows: [[time, 'Label Value 1', 'Label Value 2', 4]],
                },
                {
                    type: 'table',
                    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #C' }],
                    rows: [[time, 'Label Value 1', 'Label Value 2', 7]],
                },
            ];
            describe('getColumns', function () {
                it('should return data columns given a single query', function () {
                    var columns = transformers[transform].getColumns(singleQueryData);
                    expect(columns[0].text).toBe('Time');
                    expect(columns[1].text).toBe('Label Key 1');
                    expect(columns[2].text).toBe('Value');
                });
                it('should return the union of data columns given a multiple queries', function () {
                    var columns = transformers[transform].getColumns(multipleQueriesDataSameLabels);
                    expect(columns[0].text).toBe('Time');
                    expect(columns[1].text).toBe('Label Key 1');
                    expect(columns[2].text).toBe('Label Key 2');
                    expect(columns[3].text).toBe('Value #A');
                    expect(columns[4].text).toBe('Value #B');
                });
            });
            describe('transform', function () {
                it('should throw an error with non-table data', function () {
                    expect(function () { return transformDataToTable(nonTableData, panel); }).toThrow();
                });
                it('should return 3 columns for single queries', function () {
                    table = transformDataToTable(singleQueryData, panel);
                    expect(table.columns.length).toBe(3);
                    expect(table.columns[0].text).toBe('Time');
                    expect(table.columns[1].text).toBe('Label Key 1');
                    expect(table.columns[2].text).toBe('Value');
                });
                it('should return the union of columns for multiple queries', function () {
                    table = transformDataToTable(multipleQueriesDataSameLabels, panel);
                    expect(table.columns.length).toBe(6);
                    expect(table.columns[0].text).toBe('Time');
                    expect(table.columns[1].text).toBe('Label Key 1');
                    expect(table.columns[2].text).toBe('Label Key 2');
                    expect(table.columns[3].text).toBe('Value #A');
                    expect(table.columns[4].text).toBe('Value #B');
                    expect(table.columns[5].text).toBe('Value #C');
                });
                it('should return 1 row for a single query', function () {
                    table = transformDataToTable(singleQueryData, panel);
                    expect(table.rows.length).toBe(1);
                    expect(table.rows[0][0]).toBe(time);
                    expect(table.rows[0][1]).toBe('Label Value 1');
                    expect(table.rows[0][2]).toBe(42);
                });
                it('should return 2 rows for a multiple queries with same label values plus one extra row', function () {
                    table = transformDataToTable(multipleQueriesDataSameLabels, panel);
                    expect(table.rows.length).toBe(2);
                    expect(table.rows[0][0]).toBe(time);
                    expect(table.rows[0][1]).toBe('Label Value 1');
                    expect(table.rows[0][2]).toBe('Label Value 2');
                    expect(table.rows[0][3]).toBe(42);
                    expect(table.rows[0][4]).toBe(13);
                    expect(table.rows[0][5]).toBe(4);
                    expect(table.rows[1][0]).toBe(time);
                    expect(table.rows[1][1]).toBe('Label Value 1');
                    expect(table.rows[1][2]).toBe('Label Value 2');
                    expect(table.rows[1][3]).toBeUndefined();
                    expect(table.rows[1][4]).toBeUndefined();
                    expect(table.rows[1][5]).toBe(7);
                });
            });
        });
    });
    describe('doc data sets', function () {
        describe('JSON Data', function () {
            var panel = {
                transform: 'json',
                columns: [
                    { text: 'Timestamp', value: 'timestamp' },
                    { text: 'Message', value: 'message' },
                    { text: 'nested.level2', value: 'nested.level2' },
                ],
            };
            var rawData = [
                {
                    type: 'docs',
                    datapoints: [
                        {
                            timestamp: 'time',
                            message: 'message',
                            nested: {
                                level2: 'level2-value',
                            },
                        },
                    ],
                },
            ];
            describe('getColumns', function () {
                it('should return nested properties', function () {
                    var columns = transformers['json'].getColumns(rawData);
                    expect(columns[0].text).toBe('timestamp');
                    expect(columns[1].text).toBe('message');
                    expect(columns[2].text).toBe('nested.level2');
                });
            });
            describe('transform', function () {
                beforeEach(function () {
                    table = transformDataToTable(rawData, panel);
                });
                it('should return 2 columns', function () {
                    expect(table.columns.length).toBe(3);
                    expect(table.columns[0].text).toBe('Timestamp');
                    expect(table.columns[1].text).toBe('Message');
                    expect(table.columns[2].text).toBe('nested.level2');
                });
                it('should return 2 rows', function () {
                    expect(table.rows.length).toBe(1);
                    expect(table.rows[0][0]).toBe('time');
                    expect(table.rows[0][1]).toBe('message');
                    expect(table.rows[0][2]).toBe('level2-value');
                });
            });
        });
    });
    describe('annotation data', function () {
        describe('Annnotations', function () {
            var panel = { transform: 'annotations' };
            var rawData = {
                annotations: [
                    {
                        time: 1000,
                        text: 'hej',
                        tags: ['tags', 'asd'],
                        title: 'title',
                    },
                ],
            };
            beforeEach(function () {
                table = transformDataToTable(rawData, panel);
            });
            it('should return 4 columns', function () {
                expect(table.columns.length).toBe(4);
                expect(table.columns[0].text).toBe('Time');
                expect(table.columns[1].text).toBe('Title');
                expect(table.columns[2].text).toBe('Text');
                expect(table.columns[3].text).toBe('Tags');
            });
            it('should return 1 rows', function () {
                expect(table.rows.length).toBe(1);
                expect(table.rows[0][0]).toBe(1000);
            });
        });
    });
});
//# sourceMappingURL=transformers.test.js.map