import { FieldType } from '@grafana/data';

import { EmptyLabelValue } from '../types';

import { convertToWorkbenchRows } from './dataTransform';

/**
 * convertToWorkbenchRows transforms alert instance count data into a hierarchical structure of alert rules.
 *
 * Input: DataFrame[] from an instant query that counts deduplicated alert instances per rule.
 *        Each row represents a unique (ruleUID, alertstate, groupByLabel...) combination at a single timestamp.
 *
 * Output: A hierarchical structure where:
 *         - Multiple rows from the same rule are aggregated into a single alert rule row
 *         - Alert rules can be grouped by label values (team, severity, etc.)
 *         - Empty label values are placed at the end of each group level
 *         - Each row includes instanceCounts (firing/pending) summed from all rows for that rule
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
            { name: 'Value', type: FieldType.number, values: [1], config: {} },
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
            { name: 'Value', type: FieldType.number, values: [1], config: {} },
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
            { name: 'Value', type: FieldType.number, values: [1], config: {} },
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
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
            { name: 'Value', type: FieldType.number, values: [1], config: {} },
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
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid'], config: {} },
            { name: 'Value', type: FieldType.number, values: [1], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('no grouping - flat alert rule list', () => {
    it('should deduplicate alert rule rows and sum instance counts', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert1', 'Alert2'], config: {} },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder1', 'Folder2'],
              config: {},
            },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid1', 'uid2'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'pending'], config: {} },
            { name: 'Value', type: FieldType.number, values: [5, 2, 1], config: {} },
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
          instanceCounts: { firing: 5, pending: 2 },
        },
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert2',
            folder: 'Folder2',
            ruleUID: 'uid2',
          },
          instanceCounts: { firing: 0, pending: 1 },
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
              { name: 'Value', type: FieldType.number, values: [3], config: {} },
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
          instanceCounts: { firing: 3, pending: 0 },
        },
      ]);
    });

    it('should aggregate multiple rows from the same rule into a single alert rule row', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
            { name: 'Value', type: FieldType.number, values: [4, 2, 3, 1], config: {} },
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
          instanceCounts: { firing: 4, pending: 2 },
        },
        {
          type: 'alertRule',
          metadata: {
            title: 'Alert2',
            folder: 'Folder2',
            ruleUID: 'uid2',
          },
          instanceCounts: { firing: 3, pending: 1 },
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
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2', 'Folder1'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'firing'], config: {} },
              { name: 'Value', type: FieldType.number, values: [2, 1, 3], config: {} },
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
            instanceCounts: { firing: 2, pending: 0 },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert3',
              folder: 'Folder1',
              ruleUID: 'uid3',
            },
            instanceCounts: { firing: 3, pending: 0 },
          },
        ],
        instanceCounts: { firing: 5, pending: 0 },
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
            instanceCounts: { firing: 0, pending: 1 },
          },
        ],
        instanceCounts: { firing: 0, pending: 1 },
      });
    });

    it('should handle empty label values and place them at the end', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
              { name: 'Value', type: FieldType.number, values: [1, 1, 1, 1], config: {} },
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
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3'],
                config: {},
              },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending', 'firing'], config: {} },
              { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
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
              { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'Value', type: FieldType.number, values: [2, 3], config: {} },
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
            instanceCounts: { firing: 2, pending: 0 },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert2',
              folder: 'Folder2',
              ruleUID: 'uid2',
            },
            instanceCounts: { firing: 0, pending: 3 },
          },
        ],
        instanceCounts: { firing: 2, pending: 3 },
      });
    });
  });

  describe('multi-level grouping', () => {
    it('should group by two levels', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
              { name: 'Value', type: FieldType.number, values: [5, 2, 3, 1], config: {} },
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
        expect(backendGroup.instanceCounts).toEqual({ firing: 5, pending: 2 });
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
              instanceCounts: { firing: 5, pending: 0 },
            },
          ],
          instanceCounts: { firing: 5, pending: 0 },
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
              instanceCounts: { firing: 0, pending: 2 },
            },
          ],
          instanceCounts: { firing: 0, pending: 2 },
        });
      }

      const frontendGroup = result.find((r) => r.type === 'group' && r.metadata.value === 'frontend');
      expect(frontendGroup).toBeDefined();
      expect(frontendGroup?.type).toBe('group');

      if (frontendGroup?.type === 'group') {
        expect(frontendGroup.instanceCounts).toEqual({ firing: 3, pending: 1 });
        expect(frontendGroup.rows).toHaveLength(2);
      }
    });

    it('should group by three levels', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'Value', type: FieldType.number, values: [4, 2], config: {} },
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
        expect(result[0].instanceCounts).toEqual({ firing: 4, pending: 2 });
        expect(result[0].rows).toHaveLength(1);

        const severityGroup = result[0].rows[0];
        expect(severityGroup.type).toBe('group');

        if (severityGroup.type === 'group') {
          expect(severityGroup.metadata.label).toBe('severity');
          expect(severityGroup.metadata.value).toBe('critical');
          expect(severityGroup.instanceCounts).toEqual({ firing: 4, pending: 2 });
          expect(severityGroup.rows).toHaveLength(2);

          const regionGroup1 = severityGroup.rows[0];
          const regionGroup2 = severityGroup.rows[1];

          expect(regionGroup1.type).toBe('group');
          expect(regionGroup2.type).toBe('group');

          if (regionGroup1.type === 'group' && regionGroup2.type === 'group') {
            expect(regionGroup1.metadata.label).toBe('region');
            expect(regionGroup1.metadata.value).toBe('us-east');
            expect(regionGroup1.instanceCounts).toEqual({ firing: 4, pending: 0 });
            expect(regionGroup1.rows).toHaveLength(1);

            expect(regionGroup2.metadata.label).toBe('region');
            expect(regionGroup2.metadata.value).toBe('us-west');
            expect(regionGroup2.instanceCounts).toEqual({ firing: 0, pending: 2 });
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
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
              { name: 'Value', type: FieldType.number, values: [1, 1, 1, 1], config: {} },
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
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
              { name: 'Value', type: FieldType.number, values: [3, 1, 5, 2], config: {} },
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
          instanceCounts: { firing: 3, pending: 1 },
        });
        expect(backendGroup.instanceCounts).toEqual({ firing: 3, pending: 1 });
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
          instanceCounts: { firing: 5, pending: 2 },
        });
        expect(frontendGroup.instanceCounts).toEqual({ firing: 5, pending: 2 });
      }
    });
  });

  describe('grouping by non-existent field', () => {
    it('should treat all values as empty when grouping by field that does not exist', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'Value', type: FieldType.number, values: [4, 2], config: {} },
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
            instanceCounts: { firing: 4, pending: 0 },
          },
          {
            type: 'alertRule',
            metadata: {
              title: 'Alert2',
              folder: 'Folder2',
              ruleUID: 'uid2',
            },
            instanceCounts: { firing: 0, pending: 2 },
          },
        ],
        instanceCounts: { firing: 4, pending: 2 },
      });
    });
  });

  describe('additional fields', () => {
    it('should work with extra fields in the data frame', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2'], config: {} },
              { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder2'], config: {} },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
              { name: 'Value', type: FieldType.number, values: [7, 3], config: {} },
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
            instanceCounts: { firing: 7, pending: 0 },
          },
        ],
        instanceCounts: { firing: 7, pending: 0 },
      });
    });
  });

  describe('alphabetical sorting', () => {
    it('should sort flat alert rule rows alphabetically by title', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Zebra', 'Alpha', 'Middle'], config: {} },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder2', 'Folder3'],
              config: {},
            },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing', 'firing'], config: {} },
            { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
          ],
          length: 3,
        },
      ]);

      expect(result.map((r) => r.type === 'alertRule' && r.metadata.title)).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('should sort alert rule rows alphabetically within groups', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Zebra', 'Alpha', 'Middle'], config: {} },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3'],
                config: {},
              },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing', 'firing'], config: {} },
              { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
              { name: 'team', type: FieldType.string, values: ['backend', 'backend', 'backend'], config: {} },
            ],
            length: 3,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(1);
      if (result[0].type === 'group') {
        expect(result[0].rows.map((r) => r.type === 'alertRule' && r.metadata.title)).toEqual([
          'Alpha',
          'Middle',
          'Zebra',
        ]);
      }
    });

    it('should sort groups alphabetically by value', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3'],
                config: {},
              },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing', 'firing'], config: {} },
              { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
              { name: 'team', type: FieldType.string, values: ['zebra', 'alpha', 'middle'], config: {} },
            ],
            length: 3,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(3);
      const groupValues = result.map((r) => r.type === 'group' && r.metadata.value);
      expect(groupValues).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('should sort case-insensitively', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['banana', 'Cherry', 'Apple'], config: {} },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder2', 'Folder3'],
              config: {},
            },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing', 'firing'], config: {} },
            { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
          ],
          length: 3,
        },
      ]);

      // Without case-insensitive sorting, uppercase 'C' would sort before lowercase 'a'/'b'
      expect(result.map((r) => r.type === 'alertRule' && r.metadata.title)).toEqual(['Apple', 'banana', 'Cherry']);
    });

    it('should sort groups alphabetically with empty groups at the end', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000], config: {} },
              { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert2', 'Alert3'], config: {} },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder2', 'Folder3'],
                config: {},
              },
              { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid2', 'uid3'], config: {} },
              { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing', 'firing'], config: {} },
              { name: 'Value', type: FieldType.number, values: [1, 1, 1], config: {} },
              { name: 'team', type: FieldType.string, values: ['zebra', '', 'alpha'], config: {} },
            ],
            length: 3,
          },
        ],
        ['team']
      );

      expect(result).toHaveLength(3);
      const groupValues = result.map((r) => r.type === 'group' && r.metadata.value);
      expect(groupValues).toEqual(['alpha', 'zebra', EmptyLabelValue]);
    });
  });

  describe('instance counts', () => {
    it('should sum firing and pending counts for a rule', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
            { name: 'Value', type: FieldType.number, values: [3, 1], config: {} },
          ],
          length: 2,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 3, pending: 1 },
        },
      ]);
    });

    it('should handle a rule with only firing instances', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
            { name: 'Value', type: FieldType.number, values: [3], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 3, pending: 0 },
        },
      ]);
    });

    it('should sum counts across groupBy combinations at the same timestamp', () => {
      // When groupBy is active, the Prometheus query produces multiple rows per (ruleUID, alertstate)
      // at the same timestamp — one per group value. Counts must be summed, not overwritten.
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000, 5000, 5000], config: {} },
            {
              name: 'alertname',
              type: FieldType.string,
              values: ['Alert1', 'Alert1', 'Alert1', 'Alert1', 'Alert1', 'Alert1'],
              config: {},
            },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['Folder1', 'Folder1', 'Folder1', 'Folder1', 'Folder1', 'Folder1'],
              config: {},
            },
            {
              name: 'grafana_rule_uid',
              type: FieldType.string,
              values: ['uid1', 'uid1', 'uid1', 'uid1', 'uid1', 'uid1'],
              config: {},
            },
            {
              name: 'alertstate',
              type: FieldType.string,
              values: ['firing', 'firing', 'firing', 'pending', 'pending', 'pending'],
              config: {},
            },
            { name: 'Value', type: FieldType.number, values: [5, 3, 1, 2, 4, 2], config: {} },
            {
              name: 'team',
              type: FieldType.string,
              values: ['backend', 'frontend', 'infra', 'backend', 'frontend', 'infra'],
              config: {},
            },
          ],
          length: 6,
        },
      ]);

      // firing = 5+3+1 = 9, pending = 2+4+2 = 8
      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 9, pending: 8 },
        },
      ]);
    });

    it('should handle "Value #<refId>" field naming from multi-query Prometheus tables', () => {
      // When multiple queries share a Scenes query runner, the Prometheus plugin
      // renames "Value" to "Value #<refId>" (e.g., "Value #B"). The transform must handle this.
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
            { name: 'Value #B', type: FieldType.number, values: [7, 3], config: {} },
          ],
          length: 2,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 7, pending: 3 },
        },
      ]);
    });

    it('should default to zero counts when Value field is missing', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing'], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 0, pending: 0 },
        },
      ]);
    });

    it('should handle a rule with only pending instances and no firing', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['pending'], config: {} },
            { name: 'Value', type: FieldType.number, values: [6], config: {} },
          ],
          length: 1,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 0, pending: 6 },
        },
      ]);
    });

    it('should sum values for same rule and alertstate across groupBy rows', () => {
      // When groupBy splits a rule's instances across multiple rows, values are summed globally
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'firing'], config: {} },
            { name: 'Value', type: FieldType.number, values: [3, 2], config: {} },
            { name: 'team', type: FieldType.string, values: ['backend', 'frontend'], config: {} },
          ],
          length: 2,
        },
      ]);

      // firing = 3+2 = 5 (summed globally across groupBy rows)
      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 5, pending: 0 },
        },
      ]);
    });

    it('should treat null and undefined Value entries as zero via fallback', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000], config: {} },
            { name: 'alertname', type: FieldType.string, values: ['Alert1', 'Alert1'], config: {} },
            { name: 'grafana_folder', type: FieldType.string, values: ['Folder1', 'Folder1'], config: {} },
            { name: 'grafana_rule_uid', type: FieldType.string, values: ['uid1', 'uid1'], config: {} },
            { name: 'alertstate', type: FieldType.string, values: ['firing', 'pending'], config: {} },
            { name: 'Value', type: FieldType.number, values: [null, undefined] as unknown as number[], config: {} },
          ],
          length: 2,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 0, pending: 0 },
        },
      ]);
    });

    it('should ignore alertstate values that are not firing or pending', () => {
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000, 5000], config: {} },
            {
              name: 'alertname',
              type: FieldType.string,
              values: ['Alert1', 'Alert1', 'Alert1', 'Alert2', 'Alert2'],
              config: {},
            },
            {
              name: 'grafana_folder',
              type: FieldType.string,
              values: ['F1', 'F1', 'F1', 'F2', 'F2'],
              config: {},
            },
            {
              name: 'grafana_rule_uid',
              type: FieldType.string,
              values: ['uid1', 'uid1', 'uid1', 'uid2', 'uid2'],
              config: {},
            },
            {
              name: 'alertstate',
              type: FieldType.string,
              values: ['normal', 'inactive', 'firing', 'normal', 'nodata'],
              config: {},
            },
            { name: 'Value', type: FieldType.number, values: [10, 5, 3, 8, 6], config: {} },
          ],
          length: 5,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'F1', ruleUID: 'uid1' },
          instanceCounts: { firing: 3, pending: 0 },
        },
        {
          type: 'alertRule',
          metadata: { title: 'Alert2', folder: 'F2', ruleUID: 'uid2' },
          instanceCounts: { firing: 0, pending: 0 },
        },
      ]);
    });

    it('should bubble up counts correctly through three-level deep groups', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000, 5000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert2', 'Alert3', 'Alert4', 'Alert4'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['F1', 'F2', 'F3', 'F4', 'F4'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid2', 'uid3', 'uid4', 'uid4'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'pending', 'firing', 'firing', 'pending'],
                config: {},
              },
              { name: 'Value', type: FieldType.number, values: [10, 5, 3, 7, 2], config: {} },
              {
                name: 'team',
                type: FieldType.string,
                values: ['backend', 'backend', 'backend', 'frontend', 'frontend'],
                config: {},
              },
              {
                name: 'severity',
                type: FieldType.string,
                values: ['critical', 'critical', 'warning', 'critical', 'critical'],
                config: {},
              },
              {
                name: 'region',
                type: FieldType.string,
                values: ['us-east', 'us-west', 'us-east', 'eu-west', 'eu-west'],
                config: {},
              },
            ],
            length: 5,
          },
        ],
        ['team', 'severity', 'region']
      );

      // Verify full tree structure with counts bubbled up at every level
      // groupBy order: team (level 0) → severity (level 1) → region (level 2)
      expect(result).toEqual([
        {
          type: 'group',
          metadata: { label: 'team', value: 'backend' },
          instanceCounts: { firing: 13, pending: 5 },
          rows: [
            {
              type: 'group',
              metadata: { label: 'severity', value: 'critical' },
              instanceCounts: { firing: 10, pending: 5 },
              rows: [
                {
                  type: 'group',
                  metadata: { label: 'region', value: 'us-east' },
                  instanceCounts: { firing: 10, pending: 0 },
                  rows: [
                    {
                      type: 'alertRule',
                      metadata: { title: 'Alert1', folder: 'F1', ruleUID: 'uid1' },
                      instanceCounts: { firing: 10, pending: 0 },
                    },
                  ],
                },
                {
                  type: 'group',
                  metadata: { label: 'region', value: 'us-west' },
                  instanceCounts: { firing: 0, pending: 5 },
                  rows: [
                    {
                      type: 'alertRule',
                      metadata: { title: 'Alert2', folder: 'F2', ruleUID: 'uid2' },
                      instanceCounts: { firing: 0, pending: 5 },
                    },
                  ],
                },
              ],
            },
            {
              type: 'group',
              metadata: { label: 'severity', value: 'warning' },
              instanceCounts: { firing: 3, pending: 0 },
              rows: [
                {
                  type: 'group',
                  metadata: { label: 'region', value: 'us-east' },
                  instanceCounts: { firing: 3, pending: 0 },
                  rows: [
                    {
                      type: 'alertRule',
                      metadata: { title: 'Alert3', folder: 'F3', ruleUID: 'uid3' },
                      instanceCounts: { firing: 3, pending: 0 },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'group',
          metadata: { label: 'team', value: 'frontend' },
          instanceCounts: { firing: 7, pending: 2 },
          rows: [
            {
              type: 'group',
              metadata: { label: 'severity', value: 'critical' },
              instanceCounts: { firing: 7, pending: 2 },
              rows: [
                {
                  type: 'group',
                  metadata: { label: 'region', value: 'eu-west' },
                  instanceCounts: { firing: 7, pending: 2 },
                  rows: [
                    {
                      type: 'alertRule',
                      metadata: { title: 'Alert4', folder: 'F4', ruleUID: 'uid4' },
                      instanceCounts: { firing: 7, pending: 2 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    });

    it('should correctly count from single-timestamp instant query data', () => {
      // Simulates the result of an instant query where all rows share the same timestamp.
      // This is the expected shape of the deduplicated badge query data.
      const result = convertToWorkbenchRows([
        {
          fields: [
            { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
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
            { name: 'Value', type: FieldType.number, values: [10, 3, 7, 2], config: {} },
            {
              name: 'team',
              type: FieldType.string,
              values: ['backend', 'backend', 'frontend', 'frontend'],
              config: {},
            },
          ],
          length: 4,
        },
      ]);

      expect(result).toEqual([
        {
          type: 'alertRule',
          metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
          instanceCounts: { firing: 10, pending: 3 },
        },
        {
          type: 'alertRule',
          metadata: { title: 'Alert2', folder: 'Folder2', ruleUID: 'uid2' },
          instanceCounts: { firing: 7, pending: 2 },
        },
      ]);
    });

    it('should use global rule counts when same rule appears in multiple groups', () => {
      const result = convertToWorkbenchRows(
        [
          {
            fields: [
              { name: 'Time', type: FieldType.time, values: [5000, 5000, 5000, 5000], config: {} },
              {
                name: 'alertname',
                type: FieldType.string,
                values: ['Alert1', 'Alert1', 'Alert1', 'Alert1'],
                config: {},
              },
              {
                name: 'grafana_folder',
                type: FieldType.string,
                values: ['Folder1', 'Folder1', 'Folder1', 'Folder1'],
                config: {},
              },
              {
                name: 'grafana_rule_uid',
                type: FieldType.string,
                values: ['uid1', 'uid1', 'uid1', 'uid1'],
                config: {},
              },
              {
                name: 'alertstate',
                type: FieldType.string,
                values: ['firing', 'firing', 'pending', 'pending'],
                config: {},
              },
              { name: 'Value', type: FieldType.number, values: [5, 8, 2, 3], config: {} },
              {
                name: 'team',
                type: FieldType.string,
                values: ['backend', 'frontend', 'backend', 'frontend'],
                config: {},
              },
            ],
            length: 4,
          },
        ],
        ['team']
      );

      // Both groups get the global summed counts for uid1: firing=5+8=13, pending=2+3=5
      expect(result).toEqual([
        {
          type: 'group',
          metadata: { label: 'team', value: 'backend' },
          rows: [
            {
              type: 'alertRule',
              metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
              instanceCounts: { firing: 13, pending: 5 },
            },
          ],
          instanceCounts: { firing: 13, pending: 5 },
        },
        {
          type: 'group',
          metadata: { label: 'team', value: 'frontend' },
          rows: [
            {
              type: 'alertRule',
              metadata: { title: 'Alert1', folder: 'Folder1', ruleUID: 'uid1' },
              instanceCounts: { firing: 13, pending: 5 },
            },
          ],
          instanceCounts: { firing: 13, pending: 5 },
        },
      ]);
    });
  });
});
