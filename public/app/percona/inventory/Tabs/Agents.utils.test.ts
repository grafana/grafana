import { Agent, AgentType, ServiceAgentPayload, ServiceAgentStatus } from '../Inventory.types';

import { AGENT_LABELS_SKIP_KEYS, AGENTS_MAIN_COLUMNS } from './Agents.constants';
import { getExtraLabels, getMainParams, toAgentModel } from './Agents.utils';

describe('toAgentModel', () => {
  it('should correctly convert payload', () => {
    const payload: ServiceAgentPayload[] = [
      {
        agent_type: AgentType.amazonRdsMysql,
        agent_id: 'agent1',
        status: ServiceAgentStatus.RUNNING,
        username: 'john',
        mongo_db_options: {
          mongo_opt_1: true,
          mongo_opt_2: ['foo', 'bar'],
        },
      },
      {
        agent_type: AgentType.mongodb,
        agent_id: 'agent2',
        status: ServiceAgentStatus.STOPPING,
        listen_port: '3000',
        pmm_agent_id: 'pmm-server',
        custom_labels: {
          aditional_prop: 'prop_value',
        },
      },
    ];

    expect(toAgentModel(payload)).toEqual<Agent[]>([
      {
        type: AgentType.amazonRdsMysql,
        params: {
          agentId: 'agent1',
          status: ServiceAgentStatus.RUNNING,
          customLabels: {
            username: 'john',
            mongo_opt_1: 'true',
            mongo_opt_2: 'foo,bar',
          },
        },
      },
      {
        type: AgentType.mongodb,
        params: {
          agentId: 'agent2',
          status: ServiceAgentStatus.STOPPING,
          customLabels: {
            listen_port: '3000',
            pmm_agent_id: 'pmm-server',
            aditional_prop: 'prop_value',
          },
        },
      },
    ]);
  });
});

describe('getExtraLabels', () => {
  it('skips default values', () => {
    const input = {
      boolean: false,
      empty_string: '',
      zero: 0,
      null: null,
    };

    expect(getExtraLabels(input)).toEqual({});
  });

  it('makes values strings', () => {
    const input = {
      string: 'value',
      number: 1,
      boolean: true,
      array: ['a', 'b', 'c'],
    };

    expect(getExtraLabels(input)).toEqual({
      string: 'value',
      number: '1',
      boolean: 'true',
      array: 'a,b,c',
    });
  });

  it('skips main columns', () => {
    const input = AGENTS_MAIN_COLUMNS.reduce(
      (prev, curr) => ({
        ...prev,
        [curr]: 'value',
      }),
      {
        nonMain: 'value',
      }
    );

    expect(getExtraLabels(input)).toEqual({
      nonMain: 'value',
    });
  });

  it('handles nested keys', () => {
    const input = {
      parent: {
        child: 'value',
      },
    };

    expect(getExtraLabels(input)).toEqual({
      'parent.child': 'value',
    });
  });

  it('handles options keys correctly', () => {
    const input = AGENT_LABELS_SKIP_KEYS.reduce(
      (prev, curr) => ({
        ...prev,
        [curr]: {
          [curr.split('_')[0]]: 'value',
        },
      }),
      {}
    );

    expect(getExtraLabels(input)).toEqual({
      azure: 'value',
      mongo: 'value',
      mysql: 'value',
      postgresql: 'value',
      valkey: 'value',
    });
  });
});

describe('getMainParams', () => {
  it('returns only main columns', () => {
    const expected = AGENTS_MAIN_COLUMNS.reduce(
      (prev, curr) => ({
        ...prev,
        [curr]: 'value',
      }),
      {}
    );
    const input = {
      ...expected,
      nonMain: 'value',
    };

    expect(getMainParams(input)).toEqual(expected);
  });
});
