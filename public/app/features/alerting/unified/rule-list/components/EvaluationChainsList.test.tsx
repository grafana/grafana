import { render, screen } from 'test/test-utils';

import { type EvaluationChain } from '../../types/evaluation-chain';

import { EvaluationChainsList } from './EvaluationChainsList';

const mockChain: EvaluationChain = {
  uid: 'chain-1',
  name: 'My Chain',
  folder: 'alerting',
  interval: '1m',
  recordingRuleRefs: ['recording-rule-uid-1'],
  alertRuleRefs: ['alert-rule-uid-1', 'alert-rule-uid-2'],
};

describe('EvaluationChainsList', () => {
  it('renders loading state', () => {
    render(<EvaluationChainsList chains={[]} isLoading={true} />);
    expect(screen.getByText(/loading chains/i)).toBeInTheDocument();
  });

  it('renders empty state when no chains', () => {
    render(<EvaluationChainsList chains={[]} isLoading={false} />);
    expect(screen.getByText(/no evaluation chains found/i)).toBeInTheDocument();
  });

  it('renders folder section and chain name', () => {
    render(<EvaluationChainsList chains={[mockChain]} isLoading={false} />);
    expect(screen.getByText('alerting')).toBeInTheDocument();
    expect(screen.getByText('My Chain')).toBeInTheDocument();
    expect(screen.getByText(/1m/)).toBeInTheDocument();
  });

  it('groups multiple chains under the same folder', () => {
    const chain2: EvaluationChain = { ...mockChain, uid: 'chain-2', name: 'Other Chain' };
    render(<EvaluationChainsList chains={[mockChain, chain2]} isLoading={false} />);

    // Only one folder header
    expect(screen.getAllByText('alerting')).toHaveLength(1);
    expect(screen.getByText('My Chain')).toBeInTheDocument();
    expect(screen.getByText('Other Chain')).toBeInTheDocument();
  });

  it('expands chain row to show members', async () => {
    const { user } = render(<EvaluationChainsList chains={[mockChain]} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: /my chain/i }));

    expect(screen.getByText('recording-rule-uid-1')).toBeInTheDocument();
    expect(screen.getByText('alert-rule-uid-1')).toBeInTheDocument();
    expect(screen.getByText('alert-rule-uid-2')).toBeInTheDocument();
  });

  it('shows recording rules before alert rules in expanded view', async () => {
    const { user } = render(<EvaluationChainsList chains={[mockChain]} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: /my chain/i }));

    const recordingEl = screen.getByText('recording-rule-uid-1');
    const alertEl = screen.getByText('alert-rule-uid-1');

    // compareDocumentPosition: 4 means alertEl follows recordingEl in the DOM
    expect(recordingEl.compareDocumentPosition(alertEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses folder section when folder header is clicked', async () => {
    const { user } = render(<EvaluationChainsList chains={[mockChain]} isLoading={false} />);

    expect(screen.getByText('My Chain')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /alerting/i }));

    expect(screen.queryByText('My Chain')).not.toBeInTheDocument();
  });
});
