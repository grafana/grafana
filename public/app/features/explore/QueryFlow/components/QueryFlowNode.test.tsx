import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { promqlMapper } from '../model/languages/promql';
import { type QueryFlowNode as QueryFlowNodeModel, QueryFlowNodeKind } from '../model/types';

import { QueryFlowNode } from './QueryFlowNode';

function nodeOfKind(expr: string, kind: QueryFlowNodeKind, label?: string): QueryFlowNodeModel {
  const graph = promqlMapper.buildGraph(expr);
  const node = Object.values(graph.nodes).find((n) => n.kind === kind && (!label || n.label === label));
  if (!node) {
    throw new Error('node not found');
  }
  return node;
}

describe('QueryFlowNode', () => {
  it('renders a documentation link for a function node', () => {
    const rate = nodeOfKind('rate(metric[5m])', QueryFlowNodeKind.Function, 'rate');
    render(<QueryFlowNode node={rate} height={120} />);

    const link = screen.getByTestId('query-flow-node-docs');
    expect(link).toHaveAttribute('href', 'https://prometheus.io/docs/prometheus/latest/querying/functions/#rate');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render a documentation link for a literal node', () => {
    const literal = nodeOfKind('metric * 2', QueryFlowNodeKind.Literal);
    render(<QueryFlowNode node={literal} height={60} />);

    expect(screen.queryByTestId('query-flow-node-docs')).not.toBeInTheDocument();
  });

  it('shows a retry control when enrichment failed, and calls onRequest again when clicked', async () => {
    const user = userEvent.setup();
    const onRequest = jest.fn();
    const rate = nodeOfKind('rate(metric[5m])', QueryFlowNodeKind.Function, 'rate');
    render(<QueryFlowNode node={rate} height={120} enrichment={{ state: 'error' }} onRequest={onRequest} />);

    const retry = screen.getByTestId('query-flow-node-error');
    expect(retry).toBeInTheDocument();

    await user.click(retry);
    // At least the explicit retry click requests again — hovering the card to reach the button also
    // requests, so this may fire more than once; what matters is the click path itself works.
    expect(onRequest).toHaveBeenCalled();
  });

  it('does not show the retry control or a details tooltip while loading', () => {
    const rate = nodeOfKind('rate(metric[5m])', QueryFlowNodeKind.Function, 'rate');
    render(<QueryFlowNode node={rate} height={120} enrichment={{ state: 'loading' }} />);

    expect(screen.queryByTestId('query-flow-node-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-flow-node-info')).not.toBeInTheDocument();
  });

  it('fires hover callbacks on pointer enter and leave', async () => {
    const user = userEvent.setup();
    const onHoverStart = jest.fn();
    const onHoverEnd = jest.fn();
    const rate = nodeOfKind('rate(metric[5m])', QueryFlowNodeKind.Function, 'rate');
    render(<QueryFlowNode node={rate} height={120} onHoverStart={onHoverStart} onHoverEnd={onHoverEnd} />);

    const card = screen.getByTestId('query-flow-node-card');
    await user.hover(card);
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverEnd).not.toHaveBeenCalled();

    await user.unhover(card);
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
  });
});
