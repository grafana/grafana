import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { lookupNode } from './lookup';
import { Parser, prefixDelimited } from './parser';

describe('Parser', () => {
  const metrics = readFileSync(join(__dirname, 'testdata', 'metrics.txt'), 'utf8').split('\n');

  it('should parse strings and build a tree', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    expect(grouping.root.groups.has('agent')).toBe(true);
    const agentGroup = grouping.root.groups.get('agent')!;

    expect(agentGroup.descendants).toBe(41);

    expect(agentGroup.groups.size).toBe(3);
    expect(agentGroup.groups.has('agent_config')).toBe(true);
    expect(agentGroup.groups.has('agent_metrics')).toBe(true);
    expect(agentGroup.groups.has('agent_wal')).toBe(true);

    // get all keys from agentGroup.groups
    const groupKeys = Array.from(agentGroup.groups.keys());
    expect(groupKeys.length).toBe(3);
    expect(groupKeys[0]).toBe('agent_config');
    expect(groupKeys[1]).toBe('agent_metrics');
    expect(groupKeys[2]).toBe('agent_wal');

    // check the values
    expect(agentGroup.values.length).toBe(8);
    expect(agentGroup.values[0]).toBe('agent');
    expect(agentGroup.values[1]).toBe('agent_build_info');
    expect(agentGroup.values[2]).toBe('agent_inflight_requests');
    expect(agentGroup.values[3]).toBe('agent_request_duration_seconds');
    expect(agentGroup.values[4]).toBe('agent_request_message_bytes');
    expect(agentGroup.values[5]).toBe('agent_response_message_bytes');
    expect(agentGroup.values[6]).toBe('agent_tcp_connections');
    expect(agentGroup.values[7]).toBe('agent_tcp_connections_limit');
  });

  it('should put metrics that match the name of the group in that group', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    const grouping = parser.parse(metrics);
    const agentGroup = lookupNode(grouping.root, 'agent');
    expect(agentGroup).not.toBeNull();
    expect(agentGroup!.values.length).toBe(8);
    expect(agentGroup!.values[0]).toBe('agent');
  });

  it('should respect maxDepth', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    parser.config.maxDepth = 1;
    const grouping = parser.parse(metrics);

    const agentGroup = lookupNode(grouping.root, 'agent');
    expect(agentGroup).not.toBeNull();
    expect(agentGroup!.values.length).toBe(41);
  });

  it('should support misc for left-over values', () => {
    const parser = new Parser();
    parser.config.idealMaxGroupSize = 5;
    parser.config.maxDepth = 1;
    parser.config.miscGroupKey = 'misc';
    const grouping = parser.parse(metrics);
    expect(grouping.root.descendants).toBe(263);
    expect(grouping.root.values.length).toBe(0);

    const miscGroup = lookupNode(grouping.root, 'misc');
    expect(miscGroup).not.toBeNull();
    expect(miscGroup!.values.length).toBe(17);
    expect(miscGroup?.descendants).toBe(17);
  });
});

describe('prefixDelimited', () => {
  it('should return the prefix of a string', () => {
    expect(prefixDelimited('agent_metrics_ha_configs_created', 0)).toBe('agent');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 1)).toBe('agent_metrics');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 2)).toBe('agent_metrics_ha');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 3)).toBe('agent_metrics_ha_configs');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 4)).toBe('agent_metrics_ha_configs_created');
    expect(prefixDelimited('agent_metrics_ha_configs_created', 5)).toBe('agent_metrics_ha_configs_created');
  });
});
