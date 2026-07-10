import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { RowActionComponents } from 'app/features/query/components/QueryActionComponent';

import { QueryFlowContext, type QueryFlowContextValue } from './QueryFlowContext';
import { registerQueryFlowRowAction } from './registerQueryFlowRowAction';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function renderAction(refId: string, ctx: Partial<QueryFlowContextValue> & { openRefIds?: string[] }) {
  registerQueryFlowRowAction();
  const actions = RowActionComponents.getScopedExtraRenderAction(CoreApp.Explore);
  const { openRefIds = [], ...ctxOverrides } = ctx;
  const value: QueryFlowContextValue = {
    enabled: true,
    isOpen: (id: string) => openRefIds.includes(id),
    toggle: jest.fn(),
    close: jest.fn(),
    ...ctxOverrides,
  };
  const query: DataQuery = { refId };
  render(
    <QueryFlowContext.Provider value={value}>
      {actions.map((action, index) => action({ query, key: index }))}
    </QueryFlowContext.Provider>
  );
  return value;
}

describe('registerQueryFlowRowAction', () => {
  it('renders nothing when the feature is disabled', () => {
    renderAction('A', { enabled: false });
    expect(screen.queryByRole('button', { name: 'Query flow' })).not.toBeInTheDocument();
  });

  it('toggles the flow for the query when clicked while closed', async () => {
    const value = renderAction('B', { openRefIds: [] });
    const button = screen.getByRole('button', { name: 'Query flow' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(value.toggle).toHaveBeenCalledWith('B');
  });

  it('is active when this query has its flow open', async () => {
    const value = renderAction('A', { openRefIds: ['A'] });
    const button = screen.getByRole('button', { name: 'Query flow' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(button);
    expect(value.toggle).toHaveBeenCalledWith('A');
  });

  it('reports opened: true when toggled on from closed', async () => {
    renderAction('C', { openRefIds: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Query flow' }));
    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_query_flow_toggle', { opened: true });
  });

  it('reports opened: false when toggled off from open', async () => {
    renderAction('D', { openRefIds: ['D'] });
    await userEvent.click(screen.getByRole('button', { name: 'Query flow' }));
    expect(reportInteraction).toHaveBeenCalledWith('grafana_explore_query_flow_toggle', { opened: false });
  });
});
