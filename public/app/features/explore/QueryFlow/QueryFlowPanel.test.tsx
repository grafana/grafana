import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QueryFlowPanel } from './QueryFlowPanel';
import { type QueryFlowDiagnostic } from './diagnostics/types';
import { promqlMapper } from './model/languages/promql';

const noop = () => {};

describe('QueryFlowPanel', () => {
  it('renders the parsed query as nodes', () => {
    const graph = promqlMapper.buildGraph('histogram_quantile(0.99, sum by (le) (rate(metric{job="api"}[5m])))');
    render(<QueryFlowPanel graph={graph} status="valid" refId="A" onClose={noop} />);

    expect(screen.getByTestId('query-flow-graph')).toBeInTheDocument();
    expect(screen.getByText('histogram_quantile')).toBeInTheDocument();
    expect(screen.getByText('rate')).toBeInTheDocument();
    expect(screen.getByText('metric')).toBeInTheDocument();
    expect(screen.getAllByTestId('query-flow-node').length).toBeGreaterThan(2);
  });

  it('shows the query refId in the header', () => {
    render(<QueryFlowPanel status="empty" refId="B" onClose={noop} />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows an unsupported message for unsupported datasources', () => {
    render(<QueryFlowPanel status="unsupported" refId="A" onClose={noop} />);
    expect(screen.getByText(/supports Prometheus and Loki/i)).toBeInTheDocument();
  });

  it('shows a prompt when there is no graph yet', () => {
    render(<QueryFlowPanel status="empty" refId="A" onClose={noop} />);
    expect(screen.getByText(/Enter a Prometheus or Loki query/i)).toBeInTheDocument();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    render(<QueryFlowPanel status="empty" refId="A" onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Close query flow'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows separate counts for errors/warnings and tips instead of one lumped count', () => {
    const graph = promqlMapper.buildGraph('rate(metric)');
    const diagnostics: QueryFlowDiagnostic[] = [
      { id: 'e1', nodeId: 'x', severity: 'error', message: 'error one' },
      { id: 'w1', nodeId: 'x', severity: 'warning', message: 'warning one' },
      { id: 't1', nodeId: 'x', severity: 'tip', message: 'tip one' },
      { id: 't2', nodeId: 'x', severity: 'tip', message: 'tip two' },
    ];
    render(<QueryFlowPanel graph={graph} status="valid" refId="A" diagnostics={diagnostics} onClose={noop} />);

    expect(screen.getByText('2 issues')).toBeInTheDocument();
    expect(screen.getByText('2 tips')).toBeInTheDocument();
  });

  it('shows nothing when there are no diagnostics', () => {
    const graph = promqlMapper.buildGraph('rate(metric[5m])');
    render(<QueryFlowPanel graph={graph} status="valid" refId="A" diagnostics={[]} onClose={noop} />);

    expect(screen.queryByText(/issue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tip/)).not.toBeInTheDocument();
  });
});
