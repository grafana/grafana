import { FieldType } from '@grafana/data';

import { EmptyLabelValue } from '../types';

import { convertToWorkbenchRows } from './dataTransform';

/**
 * convertToWorkbenchRows transforms time series alert instance data into a hierarchical structure of alert rules.
 *
 * Input: DataFrame[] containing alert instances (firing/pending alerts) over time.
 *        Each alert instance includes metadata linking it to its parent alert rule via grafana_rule_uid.
 *
 * Output: A hierarchical structure where:
 *         - Multiple alert instances from the same rule are aggregated into a single alert rule row
 *         - Alert rules can be grouped by label values (team, severity, etc.)
 *         - Empty label values are placed at the end of each group level
 */
describe('convertToWorkbenchRows', () => {
  describe('empty and invalid data handling', () => {
    it('should return empty array when series is empty', () => {
      const result = convertToWorkbenchRows([]);

      expect(result).toEqual([]);
    });

    it('should return empty array when series has no fields', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [],
          length: 0,
        },
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when frame is missing required Time field', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'alertname', type: FieldType.string, values: ['TestAlert'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['folder'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when frame is missing required alertname field', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['folder'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when frame is missing grafana_folder field', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['TestAlert'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when frame is missing grafana_rule_uid field', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['TestAlert'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['folder'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });

    it('should return empty array when frame is missing alertstate field', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['TestAlert'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['folder'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('no grouping - flat alert rule list', () => {
    it('should aggregate alert instances into flat list of alert rules when no groupBy is provided', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert1'], config: {} },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder2', 'Folder1'],
              config: {},
            },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'firing'], config: {} },
          ],
          length: 3,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert1',
            folder: 'Folder1',
            ruleUID: 'uid1',
          },
        },
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert2',
            folder: 'Folder2',
            ruleUID: 'uid2',
          },
        },
      ]);
    });

    it('should return flat list when groupBy is empty array', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['TestAlert'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['TestFolder'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['test-uid'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
            ],
            length: 1,
          },
        ],
        []
      );

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: {
            title: 'TestAlert',
            folder: 'TestFolder',
            ruleUID: 'test-uid',
          },
        },
      ]);
    });

    it('should aggregate multiple alert instances from the same rule into a single alert rule', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000, 4000], config: {} },
            {
              name: 'alertname',
              type: FieldType.string,
              values: ['Alert1', 'Alert1', 'Alert2', 'Alert1'],
              config: {},
            },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder1', 'Folder2', 'Folder1'],
              config: {},
            },
            {
              name: 'grafana_rule_uid',
              type: FieldType.string,
              values: ['uid1', 'uid1', 'uid2', 'uid1'],
              config: {},
            },
            {
              name: 'alertstate',
              type: FieldType.string,
              values: ['firing', 'pending', 'firing', 'firing'],
              config: {},
            },
          ],
          length: 4,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert1',
            folder: 'Folder1',
            ruleUID: 'uid1',
          },
        },
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert2',
            folder: 'Folder2',
            ruleUID: 'uid2',
          },
        },
      ]);
    });
  });

  describe('single-level grouping', () => {
    it('should group by single field', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2', 'Folder1'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'firing'], config: {} },
              { name: 'team', type: FieldType.string, values: ['backend', 'frontend', 'backend'], config: {} },
            ],
            length: 3,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'group',
        metadata: {
          label: 'team',
          value: 'backend',
        },
        rows: [
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert1',
              folder: 'Folder1',
              ruleUID: 'uid1',
            },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert3',
              folder: 'Folder1',
              ruleUID: 'uid3',
            },
          },
        ],
      });
      expect(result[1]).toEqual({
        type: 'group',
        metadata: {
          label: 'team',
          value: 'frontend',
        },
        rows: [
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert2',
              folder: 'Folder2',
              ruleUID: 'uid2',
            },
          },
        ],
      });
    });

    it('should handle empty label values and place them at the end', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000, 4000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert2', 'Alert3', 'Alert4'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3', 'Folder4'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid2', 'uid3', 'uid4'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'pending', 'firing', 'pending'],
                config: {},
              },
              { name: 'team', type: FieldType.string, values: ['backend', '', 'frontend', ''], config: {} },
            ],
            length: 4,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('group');
      expect(result[1].type).toBe('group');
      expect(result[2].type).toBe('group');
      if (result[0].type === 'group') {
        expect(result[0].metadata.value).toBe('backend');
      }
      if (result[1].type === 'group') {
        expect(result[1].metadata.value).toBe('frontend');
      }
      if (result[2].type === 'group') {
        expect(result[2].metadata.value).toBe(EmptyLabelValue);
      }
    });

    it('should handle undefined label values and place them at the end', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3'],
                config: {},
              },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'firing'], config: {} },
              { name: 'team', type: FieldType.string, values: ['backend', undefined, 'frontend'], config: {} },
            ],
            length: 3,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('group');
      expect(result[1].type).toBe('group');
      expect(result[2].type).toBe('group');
      if (result[0].type === 'group') {
        expect(result[0].metadata.value).toBe('backend');
      }
      if (result[1].type === 'group') {
        expect(result[1].metadata.value).toBe('frontend');
      }
      if (result[2].type === 'group') {
        expect(result[2].metadata.value).toBe(EmptyLabelValue);
      }
    });

    it('should handle all empty label values', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'team', type: FieldType.string, values: ['', ''], config: {} },
            ],
            length: 2,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'group',
        metadata: {
          label: 'team',
          value: EmptyLabelValue,
        },
        rows: [
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert1',
              folder: 'Folder1',
              ruleUID: 'uid1',
            },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert2',
              folder: 'Folder2',
              ruleUID: 'uid2',
            },
          },
        ],
      });
    });
  });

  describe('multi-level grouping', () => {
    it('should group by two levels', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000, 4000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert2', 'Alert3', 'Alert4'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3', 'Folder4'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid2', 'uid3', 'uid4'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'pending', 'firing', 'pending'],
                config: {},
              },
              {
                name: 'team',
                type: FieldType.string,
                values: ['backend', 'backend', 'frontend', 'frontend'],
                config: {},
              },
              {
                name: 'severity',
                type: FieldType.string,
                values: ['critical', 'warning', 'critical', 'info'],
                config: {},
              },
            ],
            length: 4,
          },
        ],
        ['team', 'severity']
      );

      expect(result).toHaveLength(2);

      const backendGroup = result.find((r) => r.type === 'group' && r.metadata.value === 'backend');
      expect(backendGroup).toBeDefined();
      expect(backendGroup?.type).toBe('group');

      if (backendGroup?.type === 'group') {
        expect(backendGroup.rows).toHaveLength(2);
        expect(backendGroup.rows[0]).toEqual({
          type: 'group',
          metadata: {
            label: 'severity',
            value: 'critical',
          },
          rows: [
            {
              type: 'alertRule',
              metadata: {
                title: 'Alert1',
                folder: 'Folder1',
                ruleUID: 'uid1',
              },
            },
          ],
        });
        expect(backendGroup.rows[1]).toEqual({
          type: 'group',
          metadata: {
            label: 'severity',
            value: 'warning',
          },
          rows: [
            {
              type: 'alertRule',
              metadata: {
                title: 'Alert2',
                folder: 'Folder2',
                ruleUID: 'uid2',
              },
            },
          ],
        });
      }

      const frontendGroup = result.find((r) => r.type === 'group' && r.metadata.value === 'frontend');
      expect(frontendGroup).toBeDefined();
      expect(frontendGroup?.type).toBe('group');

      if (frontendGroup?.type === 'group') {
        expect(frontendGroup.rows).toHaveLength(2);
      }
    });

    it('should group by three levels', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'team', type: FieldType.string, values: ['backend', 'backend'], config: {} },
              { name: 'severity', type: FieldType.string, values: ['critical', 'critical'], config: {} },
              { name: 'region', type: FieldType.string, values: ['us-east', 'us-west'], config: {} },
            ],
            length: 2,
          },
        ],
        ['team', 'severity', 'region']
      );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('group');

      if (result[0].type === 'group') {
        expect(result[0].metadata.label).toBe('team');
        expect(result[0].metadata.value).toBe('backend');
        expect(result[0].rows).toHaveLength(1);

        const severityGroup = result[0].rows[0];
        expect(severityGroup.type).toBe('group');

        if (severityGroup.type === 'group') {
          expect(severityGroup.metadata.label).toBe('severity');
          expect(severityGroup.metadata.value).toBe('critical');
          expect(severityGroup.rows).toHaveLength(2);

          const regionGroup1 = severityGroup.rows[0];
          const regionGroup2 = severityGroup.rows[1];

          expect(regionGroup1.type).toBe('group');
          expect(regionGroup2.type).toBe('group');

          if (regionGroup1.type === 'group' && regionGroup2.type === 'group') {
            expect(regionGroup1.metadata.label).toBe('region');
            expect(regionGroup1.metadata.value).toBe('us-east');
            expect(regionGroup1.rows).toHaveLength(1);

            expect(regionGroup2.metadata.label).toBe('region');
            expect(regionGroup2.metadata.value).toBe('us-west');
            expect(regionGroup2.rows).toHaveLength(1);
          }
        }
      }
    });

    it('should handle empty values at multiple levels and place them at the end', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000, 4000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert2', 'Alert3', 'Alert4'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3', 'Folder4'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid2', 'uid3', 'uid4'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'pending', 'firing', 'pending'],
                config: {},
              },
              { name: 'team', type: FieldType.string, values: ['backend', '', 'backend', ''], config: {} },
              { name: 'severity', type: FieldType.string, values: ['critical', 'warning', '', 'info'], config: {} },
            ],
            length: 4,
          },
        ],
        ['team', 'severity']
      );

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('group');
      expect(result[1].type).toBe('group');

      if (result[0].type === 'group') {
        expect(result[0].metadata.value).toBe('backend');
        expect(result[0].rows).toHaveLength(2);
        const lastRow = result[0].rows[result[0].rows.length - 1];
        if (lastRow.type === 'group') {
          expect(lastRow.metadata.value).toBe(EmptyLabelValue);
        }
      }

      if (result[1].type === 'group') {
        expect(result[1].metadata.value).toBe(EmptyLabelValue);
        expect(result[1].rows).toHaveLength(2);
      }
    });
  });

  describe('alert instance aggregation with grouping', () => {
    it('should aggregate alert instances from the same rule within groups', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000, 3000, 4000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert1', 'Alert2', 'Alert2'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder1', 'Folder2', 'Folder2'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid1', 'uid2', 'uid2'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'pending', 'firing', 'pending'],
                config: {},
              },
              {
                name: 'team',
                type: FieldType.string,
                values: ['backend', 'backend', 'frontend', 'frontend'],
                config: {},
              },
            ],
            length: 4,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(2);

      const backendGroup = result[0];
      if (backendGroup.type === 'group') {
        expect(backendGroup.rows).toHaveLength(1);
        expect(backendGroup.rows[0]).toEqual({
          type: 'alertRule',
          metadata: {
            title: 'Alert1',
            folder: 'Folder1',
            ruleUID: 'uid1',
          },
        });
      }

      const frontendGroup = result[1];
      if (frontendGroup.type === 'group') {
        expect(frontendGroup.rows).toHaveLength(1);
        expect(frontendGroup.rows[0]).toEqual({
          type: 'alertRule',
          metadata: {
            title: 'Alert2',
            folder: 'Folder2',
            ruleUID: 'uid2',
          },
        });
      }
    });
  });

  describe('grouping by non-existent field', () => {
    it('should treat all values as empty when grouping by field that does not exist', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
            ],
            length: 2,
          },
        ],
        ['nonexistent']
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'group',
        metadata: {
          label: 'nonexistent',
          value: EmptyLabelValue,
        },
        rows: [
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert1',
              folder: 'Folder1',
              ruleUID: 'uid1',
            },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert2',
              folder: 'Folder2',
              ruleUID: 'uid2',
            },
          },
        ],
      });
    });
  });

  describe('additional fields', () => {
    it('should work with extra fields in the data frame', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [1000, 2000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'team', type: FieldType.string, values: ['backend', 'frontend'], config: {} },
              { name: 'severity', type: FieldType.string, values: ['critical', 'warning'], config: {} },
              { name: 'region', type: FieldType.string, values: ['us-east', 'us-west'], config: {} },
              { name: 'extra_field', type: FieldType.string, values: ['value1', 'value2'], config: {} },
            ],
            length: 2,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'group',
        metadata: {
          label: 'team',
          value: 'backend',
        },
        rows: [
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert1',
              folder: 'Folder1',
              ruleUID: 'uid1',
            },
          },
        ],
      });
    });
  });
});
