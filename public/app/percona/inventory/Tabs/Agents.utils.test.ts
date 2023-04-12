import { Agent, AgentType, ServiceAgentPayload, ServiceAgentStatus } from '../Inventory.types';

import { toAgentModel } from './Agents.utils';

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
