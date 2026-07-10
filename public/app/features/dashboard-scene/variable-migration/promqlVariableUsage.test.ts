import { classifyVariableUsagesInExpr, textReferencesVariable } from './promqlVariableUsage';

describe('textReferencesVariable', () => {
  it.each([
    ['up{instance=~"$instance"}', 'instance', true],
    ['up{instance=~"${instance}"}', 'instance', true],
    ['up{instance=~"${instance:regex}"}', 'instance', true],
    ['up{instance=~"[[instance]]"}', 'instance', true],
    ['up{instance=~"$instances"}', 'instance', false],
    ['up{instance=~"$host"}', 'instance', false],
    ['plain text with $instance inside', 'instance', true],
    ['no variables here', 'instance', false],
  ])('%s references %s -> %s', (text, name, expected) => {
    expect(textReferencesVariable(text, name)).toBe(expected);
  });
});

describe('classifyVariableUsagesInExpr', () => {
  describe('filter positions', () => {
    it('classifies a variable as full regex matcher value', () => {
      const result = classifyVariableUsagesInExpr('sum(rate(up{instance=~"$instance", job="grafana"}[5m]))', 'instance');

      expect(result.hasParseError).toBe(false);
      expect(result.usages).toEqual([{ position: 'filterValue', labelKey: 'instance', operator: '=~' }]);
    });

    it('classifies a variable as full equality matcher value', () => {
      const result = classifyVariableUsagesInExpr('up{job="$job"}', 'job');

      expect(result.usages).toEqual([{ position: 'filterValue', labelKey: 'job', operator: '=' }]);
    });

    it.each([['up{job="${job}"}'], ['up{job="[[job]]"}'], ['up{job="${job:regex}"}']])(
      'handles the %s interpolation syntax',
      (expr) => {
        const result = classifyVariableUsagesInExpr(expr, 'job');

        expect(result.hasParseError).toBe(false);
        expect(result.usages).toEqual([{ position: 'filterValue', labelKey: 'job', operator: '=' }]);
      }
    );

    it('classifies a quoted (utf8) label matcher', () => {
      const result = classifyVariableUsagesInExpr('up{"my label"=~"$val"}', 'val');

      expect(result.usages).toEqual([{ position: 'filterValue', labelKey: 'my label', operator: '=~' }]);
    });

    it('rejects negative matcher operators', () => {
      const result = classifyVariableUsagesInExpr('up{job!="$job"}', 'job');

      expect(result.usages).toEqual([{ position: 'other', context: 'unsupported matcher operator "!="' }]);
    });

    it('rejects a matcher value that combines the variable with other text', () => {
      const result = classifyVariableUsagesInExpr('up{job=~"prefix-$job"}', 'job');

      expect(result.usages).toEqual([{ position: 'other', context: 'partial label matcher value' }]);
    });

    it('rejects a variable in label key position', () => {
      const result = classifyVariableUsagesInExpr('up{$label="foo"}', 'label');

      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].position).toBe('other');
    });
  });

  describe('groupBy positions', () => {
    it('classifies a variable as by() grouping label', () => {
      const result = classifyVariableUsagesInExpr('sum by($groupby) (up)', 'groupby');

      expect(result.hasParseError).toBe(false);
      expect(result.usages).toEqual([{ position: 'groupByLabel' }]);
    });

    it('classifies a variable among other by() grouping labels', () => {
      const result = classifyVariableUsagesInExpr('sum by (job, $groupby, instance) (rate(up[5m]))', 'groupby');

      expect(result.usages).toEqual([{ position: 'groupByLabel' }]);
    });

    it('supports the trailing aggregation modifier form', () => {
      const result = classifyVariableUsagesInExpr('sum(up) by ($groupby)', 'groupby');

      expect(result.usages).toEqual([{ position: 'groupByLabel' }]);
    });

    it('rejects without() grouping', () => {
      const result = classifyVariableUsagesInExpr('sum without($groupby) (up)', 'groupby');

      expect(result.usages).toEqual([{ position: 'other', context: 'without() grouping' }]);
    });

    it('rejects on() grouping of binary expressions', () => {
      const result = classifyVariableUsagesInExpr('up / on($label) group_left() up', 'label');

      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].position).toBe('other');
    });
  });

  describe('other positions', () => {
    it('rejects a variable in metric name position', () => {
      const result = classifyVariableUsagesInExpr('rate($metric[5m])', 'metric');

      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].position).toBe('other');
    });

    it('rejects a variable in a function string argument', () => {
      const result = classifyVariableUsagesInExpr('label_replace(up, "dst", "$1", "src", "$var")', 'var');

      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].position).toBe('other');
    });
  });

  describe('multiple occurrences', () => {
    it('classifies every occurrence separately', () => {
      const expr = 'sum by($var) (rate(up{instance=~"$var"}[5m])) / sum(rate(up{instance=~"$var"}[5m]))';
      const result = classifyVariableUsagesInExpr(expr, 'var');

      expect(result.usages).toEqual([
        { position: 'groupByLabel' },
        { position: 'filterValue', labelKey: 'instance', operator: '=~' },
        { position: 'filterValue', labelKey: 'instance', operator: '=~' },
      ]);
    });

    it('only classifies the requested variable', () => {
      const expr = 'sum by($groupby) (up{instance=~"$instance"})';

      expect(classifyVariableUsagesInExpr(expr, 'groupby').usages).toEqual([{ position: 'groupByLabel' }]);
      expect(classifyVariableUsagesInExpr(expr, 'instance').usages).toEqual([
        { position: 'filterValue', labelKey: 'instance', operator: '=~' },
      ]);
      expect(classifyVariableUsagesInExpr(expr, 'other').usages).toEqual([]);
    });
  });

  describe('built-in variables', () => {
    it.each([['$__rate_interval'], ['$__interval'], ['$__range'], ['$__auto']])(
      'does not error on %s in range position',
      (builtIn) => {
        const result = classifyVariableUsagesInExpr(`rate(up{job="$job"}[${builtIn}])`, 'job');

        expect(result.hasParseError).toBe(false);
        expect(result.usages).toEqual([{ position: 'filterValue', labelKey: 'job', operator: '=' }]);
      }
    );
  });

  describe('parse errors', () => {
    it('reports unparsable expressions', () => {
      const result = classifyVariableUsagesInExpr('sum(up{job="$job"}', 'job');

      expect(result.hasParseError).toBe(true);
    });
  });
});
