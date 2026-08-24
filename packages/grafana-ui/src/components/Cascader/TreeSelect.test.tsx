import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockComboboxRect } from '../../test-utils/mockDom';

import { TreeSelect } from './TreeSelect';

const options = [
  {
    label: 'First',
    value: '1',
    items: [
      { label: 'Second', value: '2' },
      { label: 'Third', value: '3' },
    ],
  },
  { label: 'Standalone', value: '4' },
];

describe('TreeSelect', () => {
  beforeAll(() => {
    mockComboboxRect();
  });

  it('expands nested options and selects leaves', async () => {
    const onSelect = jest.fn();
    render(<TreeSelect options={options} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('treeitem', { name: 'Second' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('treeitem', { name: 'First' }));
    await userEvent.click(await screen.findByRole('treeitem', { name: 'Second' }));

    expect(onSelect).toHaveBeenCalledWith('2');
    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('collapses an expanded branch', async () => {
    render(<TreeSelect options={options} onSelect={jest.fn()} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('treeitem', { name: 'First' }));
    expect(await screen.findByRole('treeitem', { name: 'Second' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('treeitem', { name: 'First' }));
    expect(screen.queryByRole('treeitem', { name: 'Second' })).not.toBeInTheDocument();
  });

  it('displays the full path when requested', () => {
    render(
      <TreeSelect
        options={options}
        initialValue="2"
        displayAllSelectedLevels
        separator="-"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('First-Second')).toBeInTheDocument();
  });

  it('formats the custom-value description', async () => {
    render(
      <TreeSelect
        options={options}
        allowCustomValue
        formatCreateLabel={(value) => `Custom unit: ${value}`}
        onSelect={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.type(screen.getByRole('combobox'), 'custom');

    expect(await screen.findByRole('treeitem', { name: 'custom' })).toBeInTheDocument();
    expect(screen.getByText('Custom unit: custom')).toBeInTheDocument();
  });
});
