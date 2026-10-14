import { render, screen } from 'test/test-utils';

import { LabelsMeta } from './LabelsMeta';

describe('LabelsMeta', () => {
  it('shows the label count and lists the labels in the tooltip', async () => {
    const { user } = render(<LabelsMeta labels={{ team: 'ops', severity: 'critical' }} />);

    screen.getByText('2 labels');
    await user.tab();
    expect(await screen.findByText(/team/)).toBeInTheDocument();
  });

  it('uses the singular for one label', () => {
    render(<LabelsMeta labels={{ team: 'ops' }} />);
    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('counts an origin label that does not mark a plugin rule as an ordinary label', () => {
    render(<LabelsMeta labels={{ team: 'ops', __grafana_origin: 'my-app' }} />);
    expect(screen.getByText('2 labels')).toBeInTheDocument();
  });

  it('does not count the plugin origin label', () => {
    render(<LabelsMeta labels={{ team: 'ops', __grafana_origin: 'plugin/x' }} />);
    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('renders nothing when there are no displayable labels', () => {
    const { container } = render(<LabelsMeta labels={{ __grafana_origin: 'plugin/x' }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
