import { render, screen } from 'test/test-utils';

import { ResultCount } from './ResultCount';

describe('ResultCount', () => {
  it.each([
    { kind: 'alert', count: 1542, isLowerBound: false, text: '1,542 alert rules' },
    { kind: 'alert', count: 1, isLowerBound: false, text: '1 alert rule' },
    { kind: 'alert', count: 1000, isLowerBound: true, text: '1,000+ alert rules' },
    { kind: 'recording', count: 1, isLowerBound: false, text: '1 recording rule' },
    { kind: 'recording', count: 0, isLowerBound: false, text: '0 recording rules' },
  ] as const)('shows "$text" for $count $kind rules', ({ kind, count, isLowerBound, text }) => {
    render(<ResultCount kind={kind} total={{ count, isLowerBound }} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('renders nothing when the response carried no total', () => {
    const { container } = render(<ResultCount kind="alert" />);

    expect(container).toBeEmptyDOMElement();
  });
});
