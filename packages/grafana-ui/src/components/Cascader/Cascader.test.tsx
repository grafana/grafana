import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Field } from '../Forms/Field';

import { Cascader } from './Cascader';

const options = [
  {
    label: 'First',
    value: '1',
    items: [
      {
        label: 'Second',
        value: '2',
      },
      {
        label: 'Third',
        value: '3',
      },
      {
        label: 'Fourth',
        value: '4',
      },
    ],
  },
  {
    label: 'FirstFirst',
    value: '5',
  },
];

const initialOptions = [{ label: 'Initial state option', value: 'initial' }];

async function selectSecond() {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('treeitem', { name: 'First' }));
  await userEvent.click(await screen.findByRole('treeitem', { name: 'Second' }));
}

describe('Cascader', () => {
  const placeholder = 'cascader-placeholder';

  describe('options updates', () => {
    it('displays updated options', async () => {
      const onSelect = jest.fn();
      const { rerender } = render(<Cascader options={initialOptions} placeholder={placeholder} onSelect={onSelect} />);

      await userEvent.click(screen.getByPlaceholderText(placeholder));

      expect(await screen.findByText('Initial state option')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();

      rerender(<Cascader options={options} placeholder={placeholder} onSelect={onSelect} />);

      expect(screen.queryByText('Initial state option')).not.toBeInTheDocument();
      expect(await screen.findByText('First')).toBeInTheDocument();
    });

    it('filters updated results when searching', async () => {
      const onSelect = jest.fn();
      const { rerender } = render(<Cascader options={initialOptions} placeholder={placeholder} onSelect={onSelect} />);
      rerender(<Cascader options={options} placeholder={placeholder} onSelect={onSelect} />);

      await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
      expect(await screen.findByText('First / Third')).toBeInTheDocument();
    });
  });

  it('expands and collapses branches before selecting a leaf', async () => {
    const onSelect = jest.fn();
    render(<Cascader placeholder={placeholder} options={options} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('combobox'));
    const branch = await screen.findByRole('treeitem', { name: 'First' });
    await userEvent.click(branch);
    expect(await screen.findByRole('treeitem', { name: 'Second' })).toBeInTheDocument();

    await userEvent.click(branch);
    expect(screen.queryByRole('treeitem', { name: 'Second' })).not.toBeInTheDocument();

    await userEvent.click(branch);
    await userEvent.click(await screen.findByRole('treeitem', { name: 'Second' }));
    expect(onSelect).toHaveBeenLastCalledWith('2');
  });

  it('formats the custom-value description', async () => {
    render(
      <Cascader
        options={options}
        allowCustomValue
        formatCreateLabel={(value) => `Custom unit: ${value}`}
        onSelect={jest.fn()}
      />
    );

    await userEvent.type(screen.getByRole('combobox'), 'custom');

    expect(await screen.findByRole('treeitem', { name: 'custom' })).toBeInTheDocument();
    expect(screen.getByText('Custom unit: custom')).toBeInTheDocument();
  });

  it('displays selected value with all levels when displayAllSelectedLevels is true and selecting a value from the search', async () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
    await userEvent.click(await screen.findByText('First / Third'));

    expect(screen.getByDisplayValue('First / Third')).toBeInTheDocument();
  });

  it.each([
    ['the default separator', undefined, 'First / Second'],
    ['a custom separator', ',', 'First,Second'],
  ])('displays all levels with %s', async (_, separator, expected) => {
    render(
      <Cascader
        displayAllSelectedLevels
        separator={separator}
        placeholder={placeholder}
        options={options}
        onSelect={jest.fn()}
      />
    );

    await selectSecond();
    expect(screen.getByDisplayValue(expected)).toBeInTheDocument();
  });

  it.each([
    ['false', false],
    ['omitted', undefined],
  ])('displays only the last level when displayAllSelectedLevels is %s', async (_, displayAllSelectedLevels) => {
    render(
      <Cascader
        displayAllSelectedLevels={displayAllSelectedLevels}
        placeholder={placeholder}
        options={options}
        onSelect={jest.fn()}
      />
    );

    await selectSecond();
    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('should be properly associated with the Field label', () => {
    render(
      <Field label={'Cascader label'}>
        <Cascader options={options} onSelect={jest.fn()} id={'cascader'} />
      </Field>
    );

    expect(screen.getByRole('combobox', { name: 'Cascader label' })).toBeInTheDocument();
  });

  it('applies data-testid to the root element', () => {
    render(<Cascader options={options} onSelect={jest.fn()} data-testid="custom-cascader" />);
    expect(screen.getByTestId('custom-cascader')).toBeInTheDocument();
  });
});
