import { render, screen, userEvent } from 'test/test-utils';

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

  it('shows a tooltip with label content on hover', async () => {
    render(<RuleLabels labels={{ team: 'platform', env: 'prod' }} />);

    await userEvent.hover(screen.getByText('2 labels'));

    // AlertLabels renders keys and values as separate nodes; verify the tooltip appears
    // and the label key is present rather than asserting the combined "key=value" string.
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('team')).toBeInTheDocument();
  });
});
