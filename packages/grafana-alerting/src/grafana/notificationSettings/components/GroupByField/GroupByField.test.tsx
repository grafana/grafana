import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupByField } from './GroupByField';

describe('GroupByField', () => {
  it('lets the user add a custom label to group by', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<GroupByField value={['grafana_folder', 'alertname']} onChange={onChange} />);

    await user.type(screen.getByRole('combobox', { name: /group by/i }), 'team{enter}');

    expect(onChange).toHaveBeenCalledWith(['grafana_folder', 'alertname', 'team']);
  });

  it('disables the select when disabled is set', () => {
    render(<GroupByField value={[]} onChange={jest.fn()} disabled />);

    // byRole excludes disabled form controls from the accessibility tree, so `getByRole('combobox')`
    // wouldn't find it once disabled — getByLabelText isn't subject to that same exclusion.
    expect(screen.getByLabelText('Group by')).toBeDisabled();
  });
});
