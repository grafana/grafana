import { convertValuesToHistogram, getSeriesValues } from '../histogram';

describe('Graph Histogam Converter', function() {
  describe('Values to histogram converter', () => {
    let values;
    let bucketSize = 10;

    beforeEach(() => {
      values = [1, 2, 10, 11, 17, 20, 29];
    });

    it('Should convert to series-like array', () => {
      bucketSize = 10;
      let expected = [[0, 2], [10, 3], [20, 2]];

      let histogram = convertValuesToHistogram(values, bucketSize, 1, 29);
      expect(histogram).toMatchObject(expected);
    });

    it('Should not add empty buckets', () => {
      bucketSize = 5;
      let expected = [[0, 2], [5, 0], [10, 2], [15, 1], [20, 1], [25, 1]];

      let histogram = convertValuesToHistogram(values, bucketSize, 1, 29);
      expect(histogram).toMatchObject(expected);
    });
  });

  describe('Series to values converter', () => {
    let data;

    beforeEach(() => {
      data = [
        {
          datapoints: [[1, 0], [2, 0], [10, 0], [11, 0], [17, 0], [20, 0], [29, 0]],
        },
      ];
    });

    it('Should convert to values array', () => {
      let expected = [1, 2, 10, 11, 17, 20, 29];

      let values = getSeriesValues(data);
      expect(values).toMatchObject(expected);
    });

    it('Should skip null values', () => {
      data[0].datapoints.push([null, 0]);

      let expected = [1, 2, 10, 11, 17, 20, 29];

      let values = getSeriesValues(data);
      expect(values).toMatchObject(expected);
    });
  });
});
