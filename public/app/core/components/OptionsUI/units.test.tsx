import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnitValueEditor } from './units';

const defaultItem = {
  id: 'unit',
  name: 'Unit',
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
    <UnitValueEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="unit-editor"
    />
  );
  return { onChange };
};

describe('UnitValueEditor', () => {
  it('renders without crashing', () => {
    setup(undefined);
    expect(document.body).toBeTruthy();
  });

  it('renders a clear button when isClearable=true and value is set', () => {
    setup('short', { isClearable: true });
    expect(screen.getByRole('button', { name: 'Clear unit selection' })).toBeInTheDocument();
  });

  it('calls onChange with undefined when clear button is clicked', async () => {
    const { onChange } = setup('short', { isClearable: true });
    await userEvent.click(screen.getByRole('button', { name: 'Clear unit selection' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not render clear button when isClearable is false', () => {
    setup('short', { isClearable: false });
    expect(screen.queryByRole('button', { name: 'Clear unit selection' })).not.toBeInTheDocument();
  });

  it('does not render clear button when value is undefined even if isClearable=true', () => {
    setup(undefined, { isClearable: true });
    expect(screen.queryByRole('button', { name: 'Clear unit selection' })).not.toBeInTheDocument();
  });
});
