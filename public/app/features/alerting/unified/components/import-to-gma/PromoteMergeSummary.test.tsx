import { render, screen } from 'test/test-utils';

import { PromoteMergeSummary } from './ImportToGMA';
import { type PromoteStatsSummary } from './types';

const emptyStats: PromoteStatsSummary = {
  route: false,
  receivers: 0,
  templates: 0,
  timeIntervals: 0,
  inhibitionRules: 0,
};

describe('PromoteMergeSummary', () => {
  it('renders nothing when no resources are merged', () => {
    const { container } = render(<PromoteMergeSummary stats={emptyStats} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists only the resource types present in the merge, with correct pluralization', () => {
    render(
      <PromoteMergeSummary stats={{ route: true, receivers: 2, templates: 1, timeIntervals: 0, inhibitionRules: 3 }} />
    );

    const summary = screen.getByText(/will merge into your live config/i);
    expect(summary).toHaveTextContent('2 contact points');
    expect(summary).toHaveTextContent('1 template');
    expect(summary).toHaveTextContent('3 inhibition rules');
    expect(summary).toHaveTextContent('a notification route');
    // Types with a zero count are omitted entirely.
    expect(summary).not.toHaveTextContent(/mute timing/i);
  });
});
