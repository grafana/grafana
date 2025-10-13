import { config } from 'app/core/config';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

export const hiddenReducerTypes = ['percent_diff', 'percent_diff_abs'];
export class ThresholdMapper {
  static alertToGraphThresholds(panel: PanelModel) {
    if (!panel.alert || config.unifiedAlertingEnabled) {
      return false; // no update when no alerts
    }

    for (let i = 0; i < panel.alert.conditions.length; i++) {
      const condition = panel.alert.conditions[i];
      if (condition.type !== 'query') {
        continue;
      }

      const evaluator = condition.evaluator;
      const thresholds: any[] = (panel.thresholds = []);
      const visible = hiddenReducerTypes.indexOf(condition.reducer?.type) === -1;

      switch (evaluator.type) {
        case 'gt': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'gt', visible });
          break;
        }
        case 'lt': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'lt', visible });
          break;
        }
        case 'eq': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'eq', visible });
          break;
        }
        case 'ne': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'ne', visible });
          break;
        }
        case 'gte': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'ge', visible });
          break;
        }
        case 'lte': {
          const value = evaluator.params[0];
          thresholds.push({ value: value, op: 'le', visible });
          break;
        }
        case 'outside_range': {
          const value1 = evaluator.params[0];
          const value2 = evaluator.params[1];

          if (value1 > value2) {
            thresholds.push({ value: value1, op: 'gt', visible });
            thresholds.push({ value: value2, op: 'lt', visible });
          } else {
            thresholds.push({ value: value1, op: 'lt', visible });
            thresholds.push({ value: value2, op: 'gt', visible });
          }

          break;
        }
        case 'within_range': {
          const value1 = evaluator.params[0];
          const value2 = evaluator.params[1];

          if (value1 > value2) {
            thresholds.push({ value: value1, op: 'lt', visible });
            thresholds.push({ value: value2, op: 'gt', visible });
          } else {
            thresholds.push({ value: value1, op: 'gt', visible });
            thresholds.push({ value: value2, op: 'lt', visible });
          }
          break;
        }
        case 'outside_range_included': {
          const value1 = evaluator.params[0];
          const value2 = evaluator.params[1];

          if (value1 >= value2) {
            thresholds.push({ value: value1, op: 'ge', visible });
            thresholds.push({ value: value2, op: 'le', visible });
          } else {
            thresholds.push({ value: value1, op: 'le', visible });
            thresholds.push({ value: value2, op: 'ge', visible });
          }

          break;
        }
        case 'within_range_included': {
          const value1 = evaluator.params[0];
          const value2 = evaluator.params[1];

          if (value1 >= value2) {
            thresholds.push({ value: value1, op: 'le', visible });
            thresholds.push({ value: value2, op: 'ge', visible });
          } else {
            thresholds.push({ value: value1, op: 'ge', visible });
            thresholds.push({ value: value2, op: 'le', visible });
          }
          break;
        }
      }
      break;
    }

    for (const t of panel.thresholds) {
      t.fill = panel.options.alertThreshold;
      t.line = panel.options.alertThreshold;
      t.colorMode = 'critical';
    }

    const updated = true;
    return updated;
  }
}
