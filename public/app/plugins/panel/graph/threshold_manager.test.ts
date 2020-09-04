import templateSrv from 'app/features/templating/template_srv';
import { TimeRange } from '@grafana/data';
import { ThresholdManager } from './threshold_manager';

describe('thresholdsForm', () => {
  const ctx: any = {
    panel: {
      thresholds: [
        {
          value: 50,
          inputValue: '${thresholdVar}',
        },
        {
          value: 10,
          inputValue: '10',
        },
      ],
    },
    options: {
      grid: { markings: [] },
    },
    panelCtrl: {},
  };

  const manager = new ThresholdManager(ctx.panelCtrl);

  function initTemplateSrv(variables: any[], timeRange?: TimeRange) {
    templateSrv.init(variables, timeRange);
  }

  describe('threshold variable support', () => {
    beforeEach(() => {
      initTemplateSrv([{ type: 'query', name: 'thresholdVar', current: { value: '100' } }]);
    });

    it('should convert variables to numbers', () => {
      manager.updateThresholds(ctx.panel);
      expect(ctx.panel.thresholds[0].value).toEqual(100);
    });
    it('should handle numbers', () => {
      manager.updateThresholds(ctx.panel);
      expect(ctx.panel.thresholds[1].value).toEqual(10);
    });
  });
});
