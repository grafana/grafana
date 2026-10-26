import { render, screen } from 'test/test-utils';

import { RuleLabels } from './RuleLabels';

describe('RuleLabels', () => {
  it('shows the label count', () => {
    render(<RuleLabels labels={{ team: 'platform', env: 'prod' }} />);

    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('shows "1 label" for a single label', () => {
    render(<RuleLabels labels={{ team: 'platform' }} />);

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('renders nothing when the labels object is empty', () => {
    const { container } = render(<RuleLabels labels={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
