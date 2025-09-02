import { AlertRuleQueryData, AlertRuleRow, GenericGroupedRow, WorkbenchRow } from '../types';

// Mock the convertToWorkbenchRows function for testing
// We'll need to export it from the Workbench.tsx file first
import { convertToWorkbenchRows } from './Workbench';

describe('convertToWorkbenchRows', () => {
  // Helper function to create mock data
  const createMockData = (
    dataPoints: Array<{
      timestamp: number;
      alertname: string;
      alertstate: 'firing' | 'pending';
      folder: string;
      ruleUID: string;
      [key: string]: any; // Allow additional fields for grouping tests
    }>
  ): AlertRuleQueryData => {
    type FieldType = AlertRuleQueryData['data']['series'][number]['fields'][number];
    // Create field definitions
    const fields: FieldType[] = [
      { name: 'Time', type: 'time', config: {}, values: [], state: null },
      { name: 'alertname', type: 'string', config: {}, values: [], state: null },
      { name: 'alertstate', type: 'string', config: {}, values: [], state: null },
      { name: 'grafana_folder', type: 'string', config: {}, values: [], state: null },
      { name: 'grafana_rule_uid', type: 'string', config: {}, values: [], state: null },
    ];

    // Add additional fields if they exist in data points
    const additionalFields = new Set<string>();
    dataPoints.forEach((dp) => {
      Object.keys(dp).forEach((key) => {
        if (!['timestamp', 'alertname', 'alertstate', 'folder', 'ruleUID'].includes(key)) {
          additionalFields.add(key);
        }
      });
    });

    additionalFields.forEach((fieldName) => {
      fields.push({
        name: fieldName,
        type: 'string',
        config: {},
        values: [],
        state: null,
      });
    });

    // Populate field values
    dataPoints.forEach((dp) => {
      fields.find((f) => f.name === 'Time')!.values.push(dp.timestamp);
      fields.find((f) => f.name === 'alertname')!.values.push(dp.alertname);
      fields.find((f) => f.name === 'alertstate')!.values.push(dp.alertstate);
      fields.find((f) => f.name === 'grafana_folder')!.values.push(dp.folder);
      fields.find((f) => f.name === 'grafana_rule_uid')!.values.push(dp.ruleUID);

      // Add additional field values
      additionalFields.forEach((fieldName) => {
        fields.find((f) => f.name === fieldName)!.values.push(dp[fieldName] ?? 'undefined');
      });
    });

    return {
      key: 'test-key',
      queries: [],
      datasource: { type: 'prometheus', uid: 'test-uid' },
      data: {
        state: 'Done',
        series: [
          {
            refId: 'A',
            fields,
            meta: {
              type: 'table',
              typeVersion: [0, 0],
              custom: {},
              executedQueryString: 'test query',
              preferredVisualisationType: 'table',
            },
            length: dataPoints.length,
          },
        ],
        annotations: [],
        request: {
          app: 'dashboard',
          requestId: 'test-request',
          timezone: 'UTC',
          range: { to: 'now', from: 'now-1h', raw: { from: 'now-1h', to: 'now' } },
          interval: '1m',
          intervalMs: 60000,
          targets: [],
          maxDataPoints: 1000,
          scopedVars: {},
          startTime: Date.now(),
          rangeRaw: { from: 'now-1h', to: 'now' },
          endTime: Date.now(),
        },
        timeRange: { to: 'now', from: 'now-1h', raw: { from: 'now-1h', to: 'now' } },
        timings: { dataProcessingTime: 10 },
      },
    };
  };

  const isAlertRuleRow = (row: WorkbenchRow): row is AlertRuleRow => {
    return 'timeline' in row;
  };

  const isGenericGroupedRow = (row: WorkbenchRow): row is GenericGroupedRow => {
    return 'metadata' in row && 'label' in row.metadata && 'value' in row.metadata;
  };

  describe('No Grouping (Flat Structure)', () => {
    it('should return flat AlertRuleRow array when no groupBy is specified', () => {
      const mockData = createMockData([
        { timestamp: 1000, alertname: 'CPU Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-1' },
        { timestamp: 2000, alertname: 'CPU Alert', alertstate: 'pending', folder: 'System', ruleUID: 'rule-1' },
        { timestamp: 1500, alertname: 'Memory Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-2' },
      ]);

      const result = convertToWorkbenchRows(mockData, []);

      expect(result).toHaveLength(2); // 2 unique rules
      expect(result.every(isAlertRuleRow)).toBe(true);

      const cpuAlert = result.find((row) => isAlertRuleRow(row) && row.metadata.title === 'CPU Alert') as AlertRuleRow;
      const memoryAlert = result.find(
        (row) => isAlertRuleRow(row) && row.metadata.title === 'Memory Alert'
      ) as AlertRuleRow;

      expect(cpuAlert).toBeDefined();
      expect(cpuAlert.metadata.ruleUID).toBe('rule-1');
      expect(cpuAlert.timeline).toHaveLength(2);
      expect(cpuAlert.timeline).toEqual([
        [1000, 'firing'],
        [2000, 'pending'],
      ]);

      expect(memoryAlert).toBeDefined();
      expect(memoryAlert.metadata.ruleUID).toBe('rule-2');
      expect(memoryAlert.timeline).toHaveLength(1);
      expect(memoryAlert.timeline).toEqual([[1500, 'firing']]);
    });

    it('should handle empty data', () => {
      const mockData = createMockData([]);
      const result = convertToWorkbenchRows(mockData, []);
      expect(result).toHaveLength(0);
    });

    it('should deduplicate timeline entries with same timestamp', () => {
      const mockData = createMockData([
        { timestamp: 1000, alertname: 'CPU Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-1' },
        { timestamp: 1000, alertname: 'CPU Alert', alertstate: 'pending', folder: 'System', ruleUID: 'rule-1' },
      ]);

      const result = convertToWorkbenchRows(mockData, []);
      expect(result).toHaveLength(1);

      const alertRule = result[0] as AlertRuleRow;
      expect(alertRule.timeline).toHaveLength(1); // Duplicates should be removed
      expect(alertRule.timeline[0]).toEqual([1000, 'firing']); // First occurrence kept
    });
  });

  describe('Single Level Grouping', () => {
    it('should group by alertstate', () => {
      const mockData = createMockData([
        { timestamp: 1000, alertname: 'CPU Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-1' },
        { timestamp: 2000, alertname: 'Memory Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-2' },
        { timestamp: 3000, alertname: 'Disk Alert', alertstate: 'pending', folder: 'Storage', ruleUID: 'rule-3' },
      ]);

      const result = convertToWorkbenchRows(mockData, ['alertstate']);

      expect(result).toHaveLength(2); // 2 groups: firing, pending
      expect(result.every(isGenericGroupedRow)).toBe(true);

      const firingGroup = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'alertstate' && row.metadata.value === 'firing'
      ) as GenericGroupedRow;

      const pendingGroup = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'alertstate' && row.metadata.value === 'pending'
      ) as GenericGroupedRow;

      expect(firingGroup).toBeDefined();
      expect(firingGroup.rows).toHaveLength(2); // CPU and Memory alerts
      expect(firingGroup.rows.every(isAlertRuleRow)).toBe(true);

      expect(pendingGroup).toBeDefined();
      expect(pendingGroup.rows).toHaveLength(1); // Disk alert
      expect(pendingGroup.rows.every(isAlertRuleRow)).toBe(true);
    });

    it('should group by custom field', () => {
      const mockData = createMockData([
        {
          timestamp: 1000,
          alertname: 'CPU Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-1',
          instance: 'server-1',
        },
        {
          timestamp: 2000,
          alertname: 'Memory Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-2',
          instance: 'server-1',
        },
        {
          timestamp: 3000,
          alertname: 'Disk Alert',
          alertstate: 'pending',
          folder: 'Storage',
          ruleUID: 'rule-3',
          instance: 'server-2',
        },
      ]);

      const result = convertToWorkbenchRows(mockData, ['instance']);

      expect(result).toHaveLength(2); // 2 groups: server-1, server-2
      expect(result.every(isGenericGroupedRow)).toBe(true);

      const server1Group = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'instance' && row.metadata.value === 'server-1'
      ) as GenericGroupedRow;

      const server2Group = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'instance' && row.metadata.value === 'server-2'
      ) as GenericGroupedRow;

      expect(server1Group).toBeDefined();
      expect(server1Group.rows).toHaveLength(2);

      expect(server2Group).toBeDefined();
      expect(server2Group.rows).toHaveLength(1);
    });
  });

  describe('Multi-Level Grouping', () => {
    it('should create nested structure with multiple groupBy fields', () => {
      const mockData = createMockData([
        {
          timestamp: 1000,
          alertname: 'CPU Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-1',
          instance: 'server-1',
        },
        {
          timestamp: 2000,
          alertname: 'Memory Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-2',
          instance: 'server-2',
        },
        {
          timestamp: 3000,
          alertname: 'Disk Alert',
          alertstate: 'pending',
          folder: 'Storage',
          ruleUID: 'rule-3',
          instance: 'server-1',
        },
        {
          timestamp: 4000,
          alertname: 'Network Alert',
          alertstate: 'pending',
          folder: 'Network',
          ruleUID: 'rule-4',
          instance: 'server-2',
        },
      ]);

      const result = convertToWorkbenchRows(mockData, ['alertstate', 'instance']);

      expect(result).toHaveLength(2); // 2 top-level groups: firing, pending
      expect(result.every(isGenericGroupedRow)).toBe(true);

      // Check firing group
      const firingGroup = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'alertstate' && row.metadata.value === 'firing'
      ) as GenericGroupedRow;

      expect(firingGroup).toBeDefined();
      expect(firingGroup.rows).toHaveLength(2); // 2 instance groups
      expect(firingGroup.rows.every(isGenericGroupedRow)).toBe(true);

      // Check nested instance groups within firing
      const firingServer1 = firingGroup.rows.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'instance' && row.metadata.value === 'server-1'
      ) as GenericGroupedRow;

      const firingServer2 = firingGroup.rows.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'instance' && row.metadata.value === 'server-2'
      ) as GenericGroupedRow;

      expect(firingServer1).toBeDefined();
      expect(firingServer1.rows).toHaveLength(1);
      expect(firingServer1.rows.every(isAlertRuleRow)).toBe(true);

      expect(firingServer2).toBeDefined();
      expect(firingServer2.rows).toHaveLength(1);
      expect(firingServer2.rows.every(isAlertRuleRow)).toBe(true);
    });

    it('should handle three levels of grouping', () => {
      const mockData = createMockData([
        {
          timestamp: 1000,
          alertname: 'CPU Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-1',
          instance: 'server-1',
          job: 'node-exporter',
        },
        {
          timestamp: 2000,
          alertname: 'Memory Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-2',
          instance: 'server-1',
          job: 'prometheus',
        },
      ]);

      const result = convertToWorkbenchRows(mockData, ['alertstate', 'instance', 'job']);

      expect(result).toHaveLength(1); // 1 alertstate group: firing

      const firingGroup = result[0] as GenericGroupedRow;
      expect(firingGroup.metadata.label).toBe('alertstate');
      expect(firingGroup.metadata.value).toBe('firing');
      expect(firingGroup.rows).toHaveLength(1); // 1 instance group: server-1

      const instanceGroup = firingGroup.rows[0] as GenericGroupedRow;
      expect(instanceGroup.metadata.label).toBe('instance');
      expect(instanceGroup.metadata.value).toBe('server-1');
      expect(instanceGroup.rows).toHaveLength(2); // 2 job groups

      expect(instanceGroup.rows.every(isGenericGroupedRow)).toBe(true);

      const jobGroup1 = instanceGroup.rows.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'job' && row.metadata.value === 'node-exporter'
      ) as GenericGroupedRow;

      const jobGroup2 = instanceGroup.rows.find(
        (row) => isGenericGroupedRow(row) && row.metadata.label === 'job' && row.metadata.value === 'prometheus'
      ) as GenericGroupedRow;

      expect(jobGroup1).toBeDefined();
      expect(jobGroup1.rows).toHaveLength(1);
      expect(jobGroup1.rows.every(isAlertRuleRow)).toBe(true);

      expect(jobGroup2).toBeDefined();
      expect(jobGroup2.rows).toHaveLength(1);
      expect(jobGroup2.rows.every(isAlertRuleRow)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing groupBy fields gracefully', () => {
      const mockData = createMockData([
        { timestamp: 1000, alertname: 'CPU Alert', alertstate: 'firing', folder: 'System', ruleUID: 'rule-1' },
      ]);

      // Try to group by a field that doesn't exist
      const result = convertToWorkbenchRows(mockData, ['nonexistent_field']);

      expect(result).toHaveLength(1);
      expect(isGenericGroupedRow(result[0])).toBe(true);

      const group = result[0] as GenericGroupedRow;
      expect(group.metadata.label).toBe('nonexistent_field');
      expect(group.metadata.value).toBe('undefined'); // Missing fields should be 'undefined'
      expect(group.rows).toHaveLength(1);
      expect(group.rows.every(isAlertRuleRow)).toBe(true);
    });

    it('should handle null and undefined values in grouping fields', () => {
      const mockData = createMockData([
        {
          timestamp: 1000,
          alertname: 'CPU Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-1',
          instance: null,
        },
        {
          timestamp: 2000,
          alertname: 'Memory Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-2',
          instance: undefined,
        },
        {
          timestamp: 3000,
          alertname: 'Disk Alert',
          alertstate: 'firing',
          folder: 'System',
          ruleUID: 'rule-3',
          instance: 'server-1',
        },
      ]);

      const result = convertToWorkbenchRows(mockData, ['instance']);

      expect(result).toHaveLength(2); // 'undefined' group and 'server-1' group

      const undefinedGroup = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.value === 'undefined'
      ) as GenericGroupedRow;

      const server1Group = result.find(
        (row) => isGenericGroupedRow(row) && row.metadata.value === 'server-1'
      ) as GenericGroupedRow;

      expect(undefinedGroup).toBeDefined();
      expect(undefinedGroup.rows).toHaveLength(2); // null and undefined both become 'undefined'

      expect(server1Group).toBeDefined();
      expect(server1Group.rows).toHaveLength(1);
    });

    it('should return empty array when required fields are missing', () => {
      // Create data without required fields
      const malformedData: AlertRuleQueryData = {
        key: 'test-key',
        queries: [],
        datasource: { type: 'prometheus', uid: 'test-uid' },
        data: {
          state: 'Done',
          series: [
            {
              refId: 'A',
              fields: [
                { name: 'Time', type: 'time', config: {}, values: [1000], state: null },
                // Missing required fields: alertname, alertstate, grafana_folder, grafana_rule_uid
              ],
              meta: {
                type: 'table',
                typeVersion: [0, 0],
                custom: {},
                executedQueryString: 'test query',
                preferredVisualisationType: 'table',
              },
              length: 1,
            },
          ],
          annotations: [],
          request: {
            app: 'dashboard',
            requestId: 'test-request',
            timezone: 'UTC',
            range: { to: 'now', from: 'now-1h', raw: { from: 'now-1h', to: 'now' } },
            interval: '1m',
            intervalMs: 60000,
            targets: [],
            maxDataPoints: 1000,
            scopedVars: {},
            startTime: Date.now(),
            rangeRaw: { from: 'now-1h', to: 'now' },
            endTime: Date.now(),
          },
          timeRange: { to: 'now', from: 'now-1h', raw: { from: 'now-1h', to: 'now' } },
          timings: { dataProcessingTime: 10 },
        },
      };

      const result = convertToWorkbenchRows(malformedData, []);
      expect(result).toHaveLength(0);
    });
  });
});
