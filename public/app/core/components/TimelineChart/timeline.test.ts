import uPlot from 'uplot';

import { getDefaultTimeRange, createTheme } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';

import { getConfig, TimelineCoreOptions } from './timeline';
import { TimelineMode } from './utils';

describe('StateTimeline uPlot integration', () => {
  const buildTestCoreOptions = (opts: Partial<TimelineCoreOptions> = {}): TimelineCoreOptions => ({
    mode: TimelineMode.Changes,
    numSeries: 1,
    theme: createTheme(),
    showValue: VisibilityMode.Always,
    isDiscrete: jest.fn(() => true),
    hasMappedNull: jest.fn(() => false),
    hasMappedNaN: jest.fn(() => false),
    getValueColor: jest.fn(() => 'white'),
    label: jest.fn(() => 'foo'),
    getTimeRange: jest.fn(() => getDefaultTimeRange()),
    getFieldConfig: jest.fn(() => ({})),
    hoverMulti: false,
    ...opts,
  });

  beforeAll(() => {
    jest.mock('uplot', () => {
      const uPlot = jest.requireActual('uplot');
      jest.spyOn(uPlot, 'orient');
      return uPlot;
    });
  });

  describe('#drawPoints', () => {
    it('returns a `drawPoints` method when a `formatValue` function is provided', () => {
      const config = getConfig(buildTestCoreOptions({ formatValue: () => 'foo' }));
      expect(typeof config.drawPoints).toBe('function');
    });

    it('returns false for `drawPoints` when no `formatValue` function is provided', () => {
      const config = getConfig(buildTestCoreOptions());
      expect(config.drawPoints).toBe(false);
    });

    it('returns false for `drawPoints` if the visibility mode is `never`', () => {
      const config = getConfig(buildTestCoreOptions({ formatValue: () => 'foo', showValue: VisibilityMode.Never }));
      expect(config.drawPoints).toBe(false);
    });

    // it('returns false for `drawPoints` if the visibility mode is `never`', () => {
    //   const { drawPoints } = getConfig(buildTestCoreOptions({ formatValue: () => 'foo' }));
    //   if (!drawPoints) {
    //     throw new Error('drawPoints is not defined');
    //   }
    //   drawPoints(uPlot, 0, );
    // });
  });
});
