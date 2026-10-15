import { render, screen } from 'test/test-utils';

import { LabelsMeta } from './LabelsMeta';

describe('LabelsMeta', () => {
  it('lists the labels in a tooltip on hover', async () => {
    const { user } = render(<LabelsMeta labels={{ team: 'ops', severity: 'critical' }} />);

    await user.hover(screen.getByText('2 labels'));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(/team/);
    expect(tooltip).toHaveTextContent(/severity/);
  });

  it('lists the labels in a tooltip on keyboard focus', async () => {
    const { user } = render(<LabelsMeta labels={{ team: 'ops' }} />);

    await user.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(/team/);
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
