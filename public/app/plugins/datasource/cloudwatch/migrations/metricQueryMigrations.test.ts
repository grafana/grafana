import { CloudWatchMetricsQuery } from '../types';

import { migrateAliasPatterns } from './metricQueryMigrations';

describe('metricQueryMigrations', () => {
  interface TestScenario {
    description?: string;
    alias: string;
    label?: string;
  }

  describe('migrateAliasPatterns', () => {
    const baseQuery: CloudWatchMetricsQuery = {
      statistic: 'Average',
      refId: 'A',
      id: '',
      region: 'us-east-2',
      namespace: 'AWS/EC2',
      period: '300',
      alias: '',
      metricName: 'CPUUtilization',
      dimensions: {},
      matchExact: false,
      expression: '',
    };
    describe('when label was not previously migrated', () => {
      const cases: TestScenario[] = [
        { description: 'Metric name', alias: '{{metric}}', label: "${PROP('MetricName')}" },
        { description: 'Trim pattern', alias: '{{  metric     }}', label: "${PROP('MetricName')}" },
        { description: 'Namespace', alias: '{{namespace}}', label: "${PROP('Namespace')}" },
        { description: 'Period', alias: '{{period}}', label: "${PROP('Period')}" },
        { description: 'Region', alias: '{{region}}', label: "${PROP('Region')}" },
        { description: 'Statistic', alias: '{{stat}}', label: "${PROP('Stat')}" },
        { description: 'Label', alias: '{{label}}', label: '${LABEL}' },
        {
          description: 'Non-existing alias pattern',
          alias: '{{anything_else}}',
          label: "${PROP('Dim.anything_else')}",
        },
        {
          description: 'Combined patterns',
          alias: 'some {{combination}} of {{label}} and {{metric}}',
          label: "some ${PROP('Dim.combination')} of ${LABEL} and ${PROP('MetricName')}",
        },
        {
          description: 'Combined patterns not trimmed',
          alias: 'some {{combination  }}{{ label}} and {{metric}}',
          label: "some ${PROP('Dim.combination')}${LABEL} and ${PROP('MetricName')}",
        },
      ];
      test.each(cases)('given old alias %p, it should be migrated to label: %p', ({ alias, label }) => {
        const testQuery = { ...baseQuery, alias };
        const result = migrateAliasPatterns(testQuery);
        expect(result.label).toBe(label);
        expect(result.alias).toBe(alias);
      });
    });

    describe('when label was previously migrated', () => {
      const cases: TestScenario[] = [
        {
          alias: '',
          label: "${PROP('MetricName')}",
        },
        { alias: '{{metric}}', label: "${PROP('Period')}" },
        { alias: '{{namespace}}', label: '' },
      ];
      test.each(cases)('it should not be migrated once again', ({ alias, label }) => {
        const testQuery = { ...baseQuery, alias, label };
        const result = migrateAliasPatterns(testQuery);
        expect(result.label).toBe(label);
        expect(result.alias).toBe(alias);
      });
    });
  });
});
