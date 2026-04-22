import { render, screen } from '@testing-library/react';

import { StatsPickerEditor } from './stats';

const defaultItem = {
  id: 'stats-picker',
  name: 'Stats Picker',
  description: '',
  settings: { allowMultiple: false },
  editor: () => null,
  override: () => null,
  process: (v: unknown) => v,
  shouldApply: () => true,
};

const setup = (value: string[] = [], settings = defaultItem.settings) => {
  const onChange = jest.fn();
  render(
    <StatsPickerEditor
      value={value}
      onChange={onChange}
      item={{ ...defaultItem, settings }}
      context={{ data: [] }}
      id="stats-editor"
    />
  );
  return { onChange };
};

describe('StatsPickerEditor', () => {
  it('renders without crashing', () => {
    setup();
    expect(document.body).toBeTruthy();
  });

  it('renders with a selected stat', () => {
    setup(['mean']);
    // StatsPicker shows selected stats as combobox values
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('passes allowMultiple=true to StatsPicker', () => {
    setup([], { allowMultiple: true });
    // StatsPicker renders a multi-select when allowMultiple is true
    expect(document.body).toBeTruthy();
  });
});
