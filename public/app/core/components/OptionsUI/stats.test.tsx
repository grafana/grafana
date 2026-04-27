import { render, screen } from '@testing-library/react';

import { ReducerID } from '@grafana/data/transformations';

import { StatsPickerEditor } from './stats';

type EditorItem = Parameters<typeof StatsPickerEditor>[0]['item'];
const baseItem = { settings: {} } as EditorItem;

describe('StatsPickerEditor', () => {
  it('renders a combobox and shows the selected stat label', () => {
    render(
      <StatsPickerEditor
        id="stats-1"
        value={[ReducerID.mean]}
        onChange={jest.fn()}
        item={baseItem}
        context={{ data: [] }}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mean')).toBeInTheDocument();
  });

  it('forwards the id prop to the combobox input', () => {
    render(
      <StatsPickerEditor
        id="my-stats"
        value={[ReducerID.sum]}
        onChange={jest.fn()}
        item={baseItem}
        context={{ data: [] }}
      />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'my-stats');
  });

  it('renders a multi-select combobox when allowMultiple is true', () => {
    const item = { settings: { allowMultiple: true } } as EditorItem;

    render(
      <StatsPickerEditor
        id="stats-multi"
        value={[ReducerID.sum]}
        onChange={jest.fn()}
        item={item}
        context={{ data: [] }}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove total/i })).toBeInTheDocument();
  });
});
