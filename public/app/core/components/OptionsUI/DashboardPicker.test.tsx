import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardPicker } from './DashboardPicker';

jest.mock('app/core/components/Select/DashboardPicker', () => ({
  DashboardPicker: jest.fn(
    ({
      onChange,
      placeholder,
      isClearable,
    }: {
      onChange: (sel?: { label?: string; value?: { uid?: string } }) => void;
      placeholder?: string;
      isClearable?: boolean;
    }) => (
      <button
        type="button"
        data-testid="dashboard-picker-stub"
        data-placeholder={placeholder ?? ''}
        data-clearable={String(isClearable)}
        onClick={() => onChange({ value: { uid: 'dash-uid-1' } })}
      >
        pick
      </button>
    )
  ),
}));

describe('DashboardPicker', () => {
  it('maps selection uid to onChange', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <DashboardPicker
        value=""
        onChange={onChange}
        item={{ settings: { placeholder: 'Choose', isClearable: true } } as Parameters<typeof DashboardPicker>[0]['item']}
        context={{ data: [] }}
      />
    );

    const stub = screen.getByTestId('dashboard-picker-stub');
    expect(stub).toHaveAttribute('data-placeholder', 'Choose');
    expect(stub).toHaveAttribute('data-clearable', 'true');

    await user.click(stub);

    expect(onChange).toHaveBeenCalledWith('dash-uid-1');
  });
});
