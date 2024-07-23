import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { collectValues, lookup, lookupNode } from './lookup';
import { Parser } from './parser';

const metrics = readFileSync(join(__dirname, 'testdata', 'metrics.txt'), 'utf8').split('\n');

describe('lookup', () => {
  it('should find exact group matches', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const group1 = lookup(grouping.root, 'agent');
    expect(group1).not.toBeNull();
    expect(group1!.descendants).toBe(41);
    expect(group1!.groups.size).toBe(1);
    expect(group1!.values.length).toBe(0);
    const allValues = collectValues(group1!);
    expect(allValues.length).toBe(41);
  });

  it('should find groups and values that contain all of the prefix', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const group1 = lookup(grouping.root, 'age');
    expect(group1).not.toBeNull();
    expect(group1!.descendants).toBe(41);
    expect(group1!.groups.size).toBe(1);
    expect(group1!.values.length).toBe(0);
    const allValues = collectValues(group1!);
    expect(allValues.length).toBe(41);
  });

  it('should find nested groups and values that match', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const matches = lookup(grouping.root, 'agent_metrics_c');
    expect(matches).not.toBeNull();
    expect(matches!.descendants).toBe(9);
    const allValues = collectValues(matches!);
    expect(allValues.length).toBe(9);
  });
});

describe('lookupNode', () => {
  it('should find matching groups by prefix', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const group1 = lookupNode(grouping.root, 'agent');
    expect(group1).not.toBeNull();
    expect(group1!.descendants).toBe(41);
    expect(group1!.groups.size).toBe(3);
    expect(group1!.values.length).toBe(8);

    const group2 = lookupNode(grouping.root, 'agent_metrics_ha_configs');
    expect(group2).not.toBeNull();
    expect(group2!.descendants).toBe(6);
    expect(group2!.values.length).toBe(6);
    expect(group2!.values[0]).toBe('agent_metrics_ha_configs_created');
    expect(group2!.values[1]).toBe('agent_metrics_ha_configs_created_total');
    expect(group2!.values[2]).toBe('agent_metrics_ha_configs_deleted');
    expect(group2!.values[3]).toBe('agent_metrics_ha_configs_deleted_total');
    expect(group2!.values[4]).toBe('agent_metrics_ha_configs_updated');
    expect(group2!.values[5]).toBe('agent_metrics_ha_configs_updated_total');
  });

  it('should be able to collect all values', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const group1 = lookupNode(grouping.root, 'agent');
    expect(group1).not.toBeNull();
    const allValues = collectValues(group1!);
    expect(allValues.length).toBe(41);

    // check a sample of values
    expect(allValues).toContain('agent_config_hash');
    expect(allValues).toContain('agent_metrics_active_instances');
    expect(allValues).toContain('agent_metrics_ha_configs_created_total');
    expect(allValues).toContain('agent_tcp_connections_limit');
    expect(allValues).toContain('agent_wal_storage_created_series_total');
  });
});
