import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { ThresholdMapper, hiddenReducerTypes } from './ThresholdMapper';
import alertDef from './alertDef';

const visibleReducerTypes = alertDef.reducerTypes
  .filter(({ value }) => hiddenReducerTypes.indexOf(value) === -1)
  .map(({ value }) => value);

describe('ThresholdMapper', () => {
  describe('with greater than evaluator', () => {
    it('can map query conditions to thresholds', () => {
      const panel = {
        type: 'graph',
        options: { alertThresholds: true },
        alert: {
          conditions: [
            {
              type: 'query',
              evaluator: { type: 'gt', params: [100] },
            },
          ],
        },
      } as unknown as PanelModel;

      const updated = ThresholdMapper.alertToGraphThresholds(panel);
      expect(updated).toBe(true);
      expect(panel.thresholds[0].op).toBe('gt');
      expect(panel.thresholds[0].value).toBe(100);
    });
  });

  describe('with outside range evaluator', () => {
    it('can map query conditions to thresholds', () => {
      const panel = {
        type: 'graph',
        options: { alertThresholds: true },
        alert: {
          conditions: [
            {
              type: 'query',
              evaluator: { type: 'outside_range', params: [100, 200] },
            },
          ],
        },
      } as unknown as PanelModel;

      const updated = ThresholdMapper.alertToGraphThresholds(panel);
      expect(updated).toBe(true);
      expect(panel.thresholds[0].op).toBe('lt');
      expect(panel.thresholds[0].value).toBe(100);

      expect(panel.thresholds[1].op).toBe('gt');
      expect(panel.thresholds[1].value).toBe(200);
    });
  });

  describe('with inside range evaluator', () => {
    it('can map query conditions to thresholds', () => {
      const panel = {
        type: 'graph',
        options: { alertThresholds: true },
        alert: {
          conditions: [
            {
              type: 'query',
              evaluator: { type: 'within_range', params: [100, 200] },
            },
          ],
        },
      } as unknown as PanelModel;

      const updated = ThresholdMapper.alertToGraphThresholds(panel);
      expect(updated).toBe(true);
      expect(panel.thresholds[0].op).toBe('gt');
      expect(panel.thresholds[0].value).toBe(100);

      expect(panel.thresholds[1].op).toBe('lt');
      expect(panel.thresholds[1].value).toBe(200);
    });
  });

  visibleReducerTypes.forEach((type) => {
    describe(`with {${type}} reducer`, () => {
      it('visible should be true', () => {
        const panel = getPanel({ reducerType: type });

        const updated = ThresholdMapper.alertToGraphThresholds(panel);

        expect(updated).toBe(true);
        expect(panel.thresholds[0]).toEqual({
          value: 100,
          op: 'gt',
          fill: true,
          line: true,
          colorMode: 'critical',
          visible: true,
        });
      });
    });
  });

  hiddenReducerTypes.forEach((type) => {
    describe(`with {${type}} reducer`, () => {
      it('visible should be false', () => {
        const panel = getPanel({ reducerType: type });

        const updated = ThresholdMapper.alertToGraphThresholds(panel);

        expect(updated).toBe(true);
        expect(panel.thresholds[0]).toEqual({
          value: 100,
          op: 'gt',
          fill: true,
          line: true,
          colorMode: 'critical',
          visible: false,
        });
      });
    });
  });
});

function getPanel({ reducerType }: { reducerType?: string } = {}) {
  const panel = {
    type: 'graph',
    options: { alertThreshold: true },
    alert: {
      conditions: [
        {
          type: 'query',
          evaluator: { type: 'gt', params: [100] },
          reducer: { type: reducerType },
        },
      ],
    },
  } as unknown as PanelModel;

  return panel;
}
