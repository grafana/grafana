export class ThresholdMapper {
  static alertToGraphThresholds(panel) {
    for (var i = 0; i < panel.alert.conditions.length; i++) {
      let condition = panel.alert.conditions[i];
      if (condition.type !== 'query') {
        continue;
      }

      var evaluator = condition.evaluator;
      var thresholds = (panel.thresholds = []);

      switch (evaluator.type) {
        case 'gt': {
          let value = evaluator.params[0];
          thresholds.push({ value: value, op: 'gt' });
          break;
        }
        case 'lt': {
          let value = evaluator.params[0];
          thresholds.push({ value: value, op: 'lt' });
          break;
        }
        case 'outside_range': {
          let value1 = evaluator.params[0];
          let value2 = evaluator.params[1];

          if (value1 > value2) {
            thresholds.push({ value: value1, op: 'gt' });
            thresholds.push({ value: value2, op: 'lt' });
          } else {
            thresholds.push({ value: value1, op: 'lt' });
            thresholds.push({ value: value2, op: 'gt' });
          }

          break;
        }
        case 'within_range': {
          let value1 = evaluator.params[0];
          let value2 = evaluator.params[1];

          if (value1 > value2) {
            thresholds.push({ value: value1, op: 'lt' });
            thresholds.push({ value: value2, op: 'gt' });
          } else {
            thresholds.push({ value: value1, op: 'gt' });
            thresholds.push({ value: value2, op: 'lt' });
          }
          break;
        }
      }
      break;
    }

    for (var t of panel.thresholds) {
      t.fill = true;
      t.line = true;
      t.colorMode = 'critical';
    }

    var updated = true;
    return updated;
  }
}
