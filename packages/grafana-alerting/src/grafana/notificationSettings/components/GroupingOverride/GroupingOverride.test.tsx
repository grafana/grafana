import { render, screen } from '../../../../../tests/test-utils';

import { GroupingOverride } from './GroupingOverride';

describe('GroupingOverride', () => {
  it('shows the default grouping and no field while there is no override', () => {
    render(<GroupingOverride value={undefined} onChange={jest.fn()} />);

    expect(screen.getByText(/grafana_folder, alertname/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^group by$/i)).not.toBeInTheDocument();
  });

  it('seeds the required labels when switched on', async () => {
    const onChange = jest.fn();
    const { user } = render(<GroupingOverride value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: /override grouping/i }));

    expect(onChange).toHaveBeenCalledWith(['grafana_folder', 'alertname']);
  });

  it('shows the field for an existing override and clears it when switched off', async () => {
    const onChange = jest.fn();
    const { user } = render(<GroupingOverride value={['grafana_folder', 'alertname', 'team']} onChange={onChange} />);

    expect(screen.getByLabelText(/^group by$/i)).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /override grouping/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disables the switch', () => {
    render(<GroupingOverride value={undefined} onChange={jest.fn()} disabled />);

    expect(screen.getByRole('switch', { name: /override grouping/i })).toBeDisabled();
  });
});
