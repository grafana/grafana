import {
  GraphSeriesValue,
  toDataFrame,
  FieldType,
  FieldCache,
  FieldColorMode,
  getColorFromHexRgbOrName,
  GrafanaThemeType,
  Field,
} from '@grafana/data';
import { getMultiSeriesGraphHoverInfo, findHoverIndexFromData, graphTimeFormat } from './utils';

const mockResult = (
  value: string,
  datapointIndex: number,
  seriesIndex: number,
  color?: string,
  label?: string,
  time?: GraphSeriesValue
) => ({
  value,
  datapointIndex,
  seriesIndex,
  color,
  label,
  time,
});

// A and B series have the same x-axis range and the datapoints are x-axis aligned
const aSeries = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [100, 200, 300] },
    {
      name: 'value',
      type: FieldType.number,
      values: [10, 20, 10],
      config: { color: { mode: FieldColorMode.Fixed, fixedColor: 'red' } },
    },
  ],
});
const bSeries = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [100, 200, 300] },
    {
      name: 'value',
      type: FieldType.number,
      values: [30, 60, 30],
      config: { color: { mode: FieldColorMode.Fixed, fixedColor: 'blue' } },
    },
  ],
});
// C-series has the same x-axis range as A and B but is missing the middle point
const cSeries = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [100, 300] },
    {
      name: 'value',
      type: FieldType.number,
      values: [30, 30],
      config: { color: { mode: FieldColorMode.Fixed, fixedColor: 'yellow' } },
    },
  ],
});

function getFixedThemedColor(field: Field): string {
  return getColorFromHexRgbOrName(field.config.color!.fixedColor!, GrafanaThemeType.Dark);
}

describe('Graph utils', () => {
  describe('getMultiSeriesGraphHoverInfo', () => {
    describe('when series datapoints are x-axis aligned', () => {
      it('returns a datapoints that user hovers over', () => {
        const aCache = new FieldCache(aSeries);
        const aValueField = aCache.getFieldByName('value');
        const aTimeField = aCache.getFieldByName('time');
        const bCache = new FieldCache(bSeries);
        const bValueField = bCache.getFieldByName('value');
        const bTimeField = bCache.getFieldByName('time');

        const result = getMultiSeriesGraphHoverInfo([aValueField!, bValueField!], [aTimeField!, bTimeField!], 0);
        expect(result.time).toBe(100);
        expect(result.results[0]).toEqual(
          mockResult('10', 0, 0, getFixedThemedColor(aValueField!), aValueField!.name, 100)
        );
        expect(result.results[1]).toEqual(
          mockResult('30', 0, 1, getFixedThemedColor(bValueField!), bValueField!.name, 100)
        );
      });

      describe('returns the closest datapoints before the hover position', () => {
        it('when hovering right before a datapoint', () => {
          const aCache = new FieldCache(aSeries);
          const aValueField = aCache.getFieldByName('value');
          const aTimeField = aCache.getFieldByName('time');
          const bCache = new FieldCache(bSeries);
          const bValueField = bCache.getFieldByName('value');
          const bTimeField = bCache.getFieldByName('time');

          //  hovering right before middle point
          const result = getMultiSeriesGraphHoverInfo([aValueField!, bValueField!], [aTimeField!, bTimeField!], 199);
          expect(result.time).toBe(100);
          expect(result.results[0]).toEqual(
            mockResult('10', 0, 0, getFixedThemedColor(aValueField!), aValueField!.name, 100)
          );
          expect(result.results[1]).toEqual(
            mockResult('30', 0, 1, getFixedThemedColor(bValueField!), bValueField!.name, 100)
          );
        });

        it('when hovering right after a datapoint', () => {
          const aCache = new FieldCache(aSeries);
          const aValueField = aCache.getFieldByName('value');
          const aTimeField = aCache.getFieldByName('time');
          const bCache = new FieldCache(bSeries);
          const bValueField = bCache.getFieldByName('value');
          const bTimeField = bCache.getFieldByName('time');

          //  hovering right after middle point
          const result = getMultiSeriesGraphHoverInfo([aValueField!, bValueField!], [aTimeField!, bTimeField!], 201);
          expect(result.time).toBe(200);
          expect(result.results[0]).toEqual(
            mockResult('20', 1, 0, getFixedThemedColor(aValueField!), aValueField!.name, 200)
          );
          expect(result.results[1]).toEqual(
            mockResult('60', 1, 1, getFixedThemedColor(bValueField!), bValueField!.name, 200)
          );
        });
      });
    });

    describe('when series x-axes are not aligned', () => {
      // aSeries and cSeries are not aligned
      // cSeries is missing a middle point
      it('hovering over a middle point', () => {
        const aCache = new FieldCache(aSeries);
        const aValueField = aCache.getFieldByName('value');
        const aTimeField = aCache.getFieldByName('time');
        const cCache = new FieldCache(cSeries);
        const cValueField = cCache.getFieldByName('value');
        const cTimeField = cCache.getFieldByName('time');

        // hovering on a middle point
        // aSeries has point at that time, cSeries doesn't
        const result = getMultiSeriesGraphHoverInfo([aValueField!, cValueField!], [aTimeField!, cTimeField!], 200);

        // we expect a time of the hovered point
        expect(result.time).toBe(200);
        // we expect middle point from aSeries (the one we are hovering over)
        expect(result.results[0]).toEqual(
          mockResult('20', 1, 0, getFixedThemedColor(aValueField!), aValueField!.name, 200)
        );
        // we expect closest point before hovered point from cSeries (1st point)
        expect(result.results[1]).toEqual(
          mockResult('30', 0, 1, getFixedThemedColor(cValueField!), cValueField!.name, 100)
        );
      });

      it('hovering right after over the middle point', () => {
        const aCache = new FieldCache(aSeries);
        const aValueField = aCache.getFieldByName('value');
        const aTimeField = aCache.getFieldByName('time');
        const cCache = new FieldCache(cSeries);
        const cValueField = cCache.getFieldByName('value');
        const cTimeField = cCache.getFieldByName('time');

        // aSeries has point at that time, cSeries doesn't
        const result = getMultiSeriesGraphHoverInfo([aValueField!, cValueField!], [aTimeField!, cTimeField!], 201);

        // we expect the time of the closest point before hover
        expect(result.time).toBe(200);
        // we expect the closest datapoint before hover from aSeries
        expect(result.results[0]).toEqual(
          mockResult('20', 1, 0, getFixedThemedColor(aValueField!), aValueField!.name, 200)
        );
        // we expect the closest datapoint before  hover from cSeries (1st point)
        expect(result.results[1]).toEqual(
          mockResult('30', 0, 1, getFixedThemedColor(cValueField!), cValueField!.name, 100)
        );
      });
    });
  });

  describe('findHoverIndexFromData', () => {
    it('returns index of the closest datapoint before hover position', () => {
      const cache = new FieldCache(aSeries);
      const timeField = cache.getFieldByName('time');
      // hovering over 1st datapoint
      expect(findHoverIndexFromData(timeField!, 0)).toBe(0);
      // hovering over right before 2nd datapoint
      expect(findHoverIndexFromData(timeField!, 199)).toBe(0);
      // hovering over 2nd datapoint
      expect(findHoverIndexFromData(timeField!, 200)).toBe(1);
      // hovering over right before 3rd datapoint
      expect(findHoverIndexFromData(timeField!, 299)).toBe(1);
      // hovering over 3rd datapoint
      expect(findHoverIndexFromData(timeField!, 300)).toBe(2);
    });
  });

  describe('graphTimeFormat', () => {
    it('graphTimeFormat', () => {
      expect(graphTimeFormat(5, 1, 45 * 5 * 1000)).toBe('HH:mm:ss');
      expect(graphTimeFormat(5, 1, 7200 * 5 * 1000)).toBe('HH:mm');
      expect(graphTimeFormat(5, 1, 80000 * 5 * 1000)).toBe('MM/DD HH:mm');
      expect(graphTimeFormat(5, 1, 2419200 * 5 * 1000)).toBe('MM/DD');
      expect(graphTimeFormat(5, 1, 12419200 * 5 * 1000)).toBe('YYYY-MM');
    });
  });
});
