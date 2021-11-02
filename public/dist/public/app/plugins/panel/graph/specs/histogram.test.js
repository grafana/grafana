import { convertValuesToHistogram, getSeriesValues } from '../histogram';
describe('Graph Histogam Converter', function () {
    describe('Values to histogram converter', function () {
        var values;
        var bucketSize = 10;
        beforeEach(function () {
            values = [29, 1, 2, 10, 11, 17, 20];
        });
        it('Should convert to series-like array', function () {
            bucketSize = 10;
            var expected = [
                [0, 2],
                [10, 3],
                [20, 2],
            ];
            var histogram = convertValuesToHistogram(values, bucketSize, 1, 30);
            expect(histogram).toMatchObject(expected);
        });
        it('Should not add empty buckets', function () {
            bucketSize = 5;
            var expected = [
                [0, 2],
                [5, 0],
                [10, 2],
                [15, 1],
                [20, 1],
                [25, 1],
            ];
            var histogram = convertValuesToHistogram(values, bucketSize, 1, 30);
            expect(histogram).toMatchObject(expected);
        });
    });
    describe('Buckets to have correct decimals', function () {
        it('Should convert to series-like array', function () {
            var expected = [[1.7000000000000002, 1]];
            var histogram = convertValuesToHistogram([1.715000033378601], 0.05, 1.7, 1.8);
            expect(histogram).toMatchObject(expected);
        });
    });
    describe('Series to values converter', function () {
        var data;
        beforeEach(function () {
            data = [
                {
                    datapoints: [
                        [1, 0],
                        [2, 0],
                        [10, 0],
                        [11, 0],
                        [17, 0],
                        [20, 0],
                        [29, 0],
                    ],
                },
            ];
        });
        it('Should convert to values array', function () {
            var expected = [1, 2, 10, 11, 17, 20, 29];
            var values = getSeriesValues(data);
            expect(values).toMatchObject(expected);
        });
        it('Should skip null values', function () {
            data[0].datapoints.push([null, 0]);
            var expected = [1, 2, 10, 11, 17, 20, 29];
            var values = getSeriesValues(data);
            expect(values).toMatchObject(expected);
        });
    });
});
//# sourceMappingURL=histogram.test.js.map