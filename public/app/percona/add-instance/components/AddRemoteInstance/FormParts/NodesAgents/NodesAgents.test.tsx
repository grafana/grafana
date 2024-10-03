import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';
import selectEvent from 'react-select-event';

import { InventoryService } from 'app/percona/inventory/Inventory.service';
import {
  nodesMockMultipleAgentsNoPMMServer,
  nodesMock,
  nodesMockOneAgentNoPMMServer,
} from 'app/percona/inventory/__mocks__/Inventory.service';
import * as NodesReducer from 'app/percona/shared/core/reducers/nodes/nodes';
import { configureStore } from 'app/store/configureStore';

import { NodesAgents } from './NodesAgents';

const fetchNodesActionActionSpy = jest.spyOn(NodesReducer, 'fetchNodesAction');

describe('Nodes Agents:: ', () => {
  const submitMock = jest.fn();

  function setup() {
    render(
      <Provider store={configureStore()}>
        <Form
          onSubmit={submitMock}
          render={({ handleSubmit, form, values }) => (
            <form data-testid="node-agents-form" onSubmit={handleSubmit}>
              <NodesAgents form={form} />
              <p data-testid="node">{values.node?.value}</p>
              <p data-testid="agent">{values.pmm_agent_id?.value}</p>
              <p data-testid="address">{values.address}</p>
            </form>
          )}
        />
      </Provider>
    );
  }

  beforeEach(() => {
    submitMock.mockClear();
  });

  it('should not pick any agent when the selected node is not pmm-server', async () => {
    jest
      .spyOn(InventoryService, 'getNodes')
      .mockReturnValue(Promise.resolve({ nodes: nodesMockMultipleAgentsNoPMMServer }));
    setup();
    await waitFor(() => {
      expect(fetchNodesActionActionSpy).toHaveBeenCalled();
    });

    const nodesSelect = screen.getByLabelText('Nodes');
    await waitFor(() =>
      selectEvent.select(nodesSelect, [nodesMockMultipleAgentsNoPMMServer[0].node_name], {
        container: document.body,
      })
    );

    expect(screen.getByTestId('agent')).toHaveTextContent('');
    expect(screen.getByTestId('node')).toHaveTextContent(nodesMockMultipleAgentsNoPMMServer[0].node_id);
  });

  it('should pick the pmm-server from the list of agents when pmm-server node is chosen', async () => {
    jest.spyOn(InventoryService, 'getNodes').mockReturnValue(Promise.resolve({ nodes: nodesMock }));
    setup();
    await waitFor(() => {
      expect(fetchNodesActionActionSpy).toHaveBeenCalled();
    });
    const nodesSelect = screen.getByLabelText('Nodes');

    await waitFor(() =>
      selectEvent.select(nodesSelect, ['pmm-server'], {
        container: document.body,
      })
    );

    expect(screen.getByTestId('agent')).toHaveTextContent('pmm-server');
    expect(screen.getByTestId('node')).toHaveTextContent('pmm-server');
  });

  it('should change the address to localhost when the agent id is not pmmServer', async () => {
    jest.spyOn(InventoryService, 'getNodes').mockReturnValue(Promise.resolve({ nodes: nodesMockOneAgentNoPMMServer }));
    setup();
    await waitFor(() => {
      expect(fetchNodesActionActionSpy).toHaveBeenCalled();
    });
    const nodesSelect = screen.getByLabelText('Nodes');

    await waitFor(() =>
      selectEvent.select(nodesSelect, [nodesMockOneAgentNoPMMServer[0].node_name], {
        container: document.body,
      })
    );
    await waitFor(() =>
      selectEvent.select(nodesSelect, [nodesMockOneAgentNoPMMServer[0].agents[0].agent_id], {
        container: document.body,
      })
    );

    expect(screen.getByTestId('address')).toHaveTextContent('localhost');
  });

  it('should have the node/agent selected values when submitted', async () => {
    jest.spyOn(InventoryService, 'getNodes').mockReturnValue(Promise.resolve({ nodes: nodesMock }));

    setup();
    await waitFor(() => {
      expect(fetchNodesActionActionSpy).toHaveBeenCalled();
    });

    const form = screen.getByTestId('node-agents-form');

    const nodesSelect = screen.getByLabelText('Nodes');
    await waitFor(() =>
      selectEvent.select(nodesSelect, 'pmm-server', {
        container: document.body,
      })
    );

    fireEvent.submit(form);

    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.objectContaining({
          value: 'pmm-server',
        }),
        pmm_agent_id: expect.objectContaining({
          value: 'pmm-server',
        }),
      }),
      expect.anything(),
      expect.anything()
    );
  });
});
