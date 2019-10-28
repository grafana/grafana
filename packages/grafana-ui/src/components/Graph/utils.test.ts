import { GraphSeriesXY, GraphSeriesValue } from '@grafana/data';
import { getMultiSeriesGraphHoverInfo, findHoverIndexFromData } from './utils';
import { GraphSeriesTogglerState } from './GraphSeriesToggler';

// A and B series have the same x-axis range and the datapoints are x-axis aligned
const aSeries = {
  data: [[100, 10], [200, 20], [300, 10]],
  color: 'red',
  isVisible: true,
  label: 'A-series',
  yAxis: { index: 0 },
  seriesIndex: 0,
};

const bSeries = {
  data: [[100, 30], [200, 60], [300, 30]],
  color: 'blue',
  isVisible: true,
  label: 'B-series',
  yAxis: { index: 0 },
  seriesIndex: 0,
};

// C-series has the same x-axis range as A and B but is missing the middle point
const cSeries = {
  data: [[100, 30], [300, 30]],
  color: 'blue',
  isVisible: true,
  label: 'B-series',
  yAxis: { index: 0 },
  seriesIndex: 0,
};

const mockResult = (
  value: GraphSeriesTogglerState,
  datapointIndex: number,
  seriesIndex: number,
  color: string,
  label: string,
  time: GraphSeriesValue
) => ({
  value,
  datapointIndex,
  seriesIndex,
  color,
  label,
  time,
});

describe('Graph utils', () => {
  describe('getMultiSeriesGraphHoverInfo', () => {
    describe('when series datapoints are x-axis aligned', () => {
      it('returns a datapoints that user hovers over', () => {
        const series: GraphSeriesXY[] = [aSeries, bSeries];
        const result = getMultiSeriesGraphHoverInfo(series, { x: 0 });
        expect(result.time).toBe(100);
        expect(result.results[0]).toEqual(mockResult(10, 0, 0, aSeries.color, aSeries.label, 100));
        expect(result.results[1]).toEqual(mockResult(30, 0, 1, bSeries.color, bSeries.label, 100));
      });

      describe('returns the closest datapoints before the hover position', () => {
        it('when hovering right before a datapoint', () => {
          const series: GraphSeriesXY[] = [aSeries, bSeries];
          //  hovering right before middle point
          const result = getMultiSeriesGraphHoverInfo(series, { x: 199 });
          expect(result.time).toBe(100);
          expect(result.results[0]).toEqual(mockResult(10, 0, 0, aSeries.color, aSeries.label, 100));
          expect(result.results[1]).toEqual(mockResult(30, 0, 1, bSeries.color, bSeries.label, 100));
        });

        it('when hovering right after a datapoint', () => {
          const series: GraphSeriesXY[] = [aSeries, bSeries];
          //  hovering right after middle point
          const result = getMultiSeriesGraphHoverInfo(series, { x: 201 });
          expect(result.time).toBe(200);
          expect(result.results[0]).toEqual(mockResult(20, 1, 0, aSeries.color, aSeries.label, 200));
          expect(result.results[1]).toEqual(mockResult(60, 1, 1, bSeries.color, bSeries.label, 200));
        });
      });
    });

    describe('when series x-axes are not aligned', () => {
      // aSeries and cSeries are not aligned
      // cSeries is missing a middle point
      it('hovering over a middle point', () => {
        const series: GraphSeriesXY[] = [aSeries, cSeries];
        // hovering on a middle point
        // aSeries has point at that time, cSeries doesn't
        const result = getMultiSeriesGraphHoverInfo(series, { x: 200 });

        // we expect a time of the hovered point
        expect(result.time).toBe(200);
        // we expect middle point from aSeries
        expect(result.results[0]).toEqual(mockResult(20, 1, 0, aSeries.color, aSeries.label, 200));
        // we expect closest point before hovered point from cSeries (1st point)
        expect(result.results[1]).toEqual(mockResult(30, 0, 1, cSeries.color, cSeries.label, 100));
      });

      it('hovering right after over the middle point', () => {
        const series: GraphSeriesXY[] = [aSeries, cSeries];

        // aSeries has point at that time, cSeries doesn't
        const result = getMultiSeriesGraphHoverInfo(series, { x: 201 });

        // we expect the time of the closest point before hover
        expect(result.time).toBe(200);
        // we expect the closest datapoint before hover from aSeries
        expect(result.results[0]).toEqual(mockResult(20, 1, 0, aSeries.color, aSeries.label, 200));
        // we expect the closest datapoint before  hover from cSeries (1st point)
        expect(result.results[1]).toEqual(mockResult(30, 0, 1, cSeries.color, cSeries.label, 100));
      });
    });
  });

  describe('findHoverIndexFromData', () => {
    it('returns index of the closest datapoint before hover position', () => {
      // hovering over 1st datapoint
      expect(findHoverIndexFromData(aSeries, 0)).toBe(0);
      // hovering over right before 2nd datapoint
      expect(findHoverIndexFromData(aSeries, 199)).toBe(0);
      // hovering over 2nd datapoint
      expect(findHoverIndexFromData(aSeries, 200)).toBe(1);
      // hovering over right before 3rd datapoint
      expect(findHoverIndexFromData(aSeries, 299)).toBe(1);
      // hovering over 3rd datapoint
      expect(findHoverIndexFromData(aSeries, 300)).toBe(2);
    });
  });
});
