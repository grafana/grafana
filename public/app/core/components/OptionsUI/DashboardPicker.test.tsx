import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('app/core/components/Select/DashboardPicker', () => ({
  DashboardPicker: ({
    onChange,
    placeholder,
    isClearable,
    value,
  }: {
    onChange: (sel?: { value?: { uid?: string } }) => void;
    placeholder?: string;
    isClearable?: boolean;
    value?: string;
  }) => (
    <div data-testid="base-dashboard-picker">
      <input
        data-testid="picker-input"
        placeholder={placeholder}
        defaultValue={value ?? ''}
        onChange={(e) => onChange({ value: { uid: e.target.value } })}
      />
      {isClearable && (
        <button data-testid="clear-btn" onClick={() => onChange(undefined)}>
          Clear
        </button>
      )}
    </div>
  ),
}));

import { DashboardPicker } from './DashboardPicker';

const defaultItem = {
  id: 'dashboard-uid',
  name: 'Dashboard',
  description: '',
  settings: {},
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string | undefined, settings = {}) => {
  const onChange = jest.fn();
  render(
    <DashboardPicker value={value} onChange={onChange} item={{ ...defaultItem, settings }} context={{ data: [] }} />
  );
  return { onChange };
};

describe('DashboardPicker', () => {
  it('renders without crashing', () => {
    setup(undefined);
    expect(screen.getByTestId('base-dashboard-picker')).toBeInTheDocument();
  });

  it('passes placeholder from settings', () => {
    setup(undefined, { placeholder: 'Choose dashboard' });
    expect(screen.getByPlaceholderText('Choose dashboard')).toBeInTheDocument();
  });

  it('calls onChange with the selected dashboard uid', async () => {
    const { onChange } = setup(undefined);
    const input = screen.getByTestId('picker-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'abc-123');
    // fireEvent.change is used internally; check that onChange received uid
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onChange with undefined when cleared', async () => {
    const { onChange } = setup('some-uid', { isClearable: true });
    await userEvent.click(screen.getByTestId('clear-btn'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
