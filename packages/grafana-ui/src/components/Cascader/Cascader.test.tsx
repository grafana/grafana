import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Field } from '../Forms/Field';

import { Cascader, type CascaderOption, type CascaderProps } from './Cascader';

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

const CascaderWithOptionsStateUpdate = (props: Omit<CascaderProps, 'options' | 'theme'>) => {
  const [updatedOptions, setOptions] = useState<CascaderOption[]>([
    {
      label: 'Initial state option',
      value: 'initial',
    },
  ]);

  setTimeout(() => setOptions(options), 1000);

  return <Cascader options={updatedOptions} {...props} />;
};

describe('Cascader', () => {
  const placeholder = 'cascader-placeholder';

  describe('options from state change', () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
      jest.useFakeTimers();
      // Need to use delay: null here to work with fakeTimers
      // see https://github.com/testing-library/user-event/issues/833
      user = userEvent.setup({ delay: null });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('displays updated options', async () => {
      render(<CascaderWithOptionsStateUpdate placeholder={placeholder} onSelect={jest.fn()} />);

      await user.click(screen.getByPlaceholderText(placeholder));

      expect(await screen.findByText('Initial state option')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();

      act(() => {
        jest.runAllTimers();
      });

      expect(screen.queryByText('Initial state option')).not.toBeInTheDocument();
      expect(await screen.findByText('First')).toBeInTheDocument();
    });

    it('filters updated results when searching', async () => {
      render(<CascaderWithOptionsStateUpdate placeholder={placeholder} onSelect={jest.fn()} />);

      act(() => {
        jest.runAllTimers();
      });

      await user.type(screen.getByPlaceholderText(placeholder), 'Third');
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
      expect(await screen.findByText('First / Third')).toBeInTheDocument();
    });
  });

  it('filters results when searching', async () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(await screen.findByText('First / Third')).toBeInTheDocument();
  });

  it('displays selected value with all levels when displayAllSelectedLevels is true and selecting a value from the search', async () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
    await userEvent.click(await screen.findByText('First / Third'));

    expect(screen.getByDisplayValue('First / Third')).toBeInTheDocument();
  });

  it('displays all levels selected with default separator when displayAllSelectedLevels is true', async () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={() => {}} />
    );

    expect(screen.queryByDisplayValue('First/Second')).not.toBeInTheDocument();

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    await userEvent.click(await screen.findByText('First'));
    await userEvent.click(await screen.findByText('Second'));

    expect(screen.getByDisplayValue('First / Second')).toBeInTheDocument();
  });

  it('displays all levels selected with separator passed in when displayAllSelectedLevels is true', async () => {
    const separator = ',';

    render(
      <Cascader
        displayAllSelectedLevels={true}
        separator={separator}
        placeholder={placeholder}
        options={options}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByDisplayValue('First/Second')).not.toBeInTheDocument();

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    await userEvent.click(await screen.findByText('First'));
    await userEvent.click(await screen.findByText('Second'));

    expect(screen.getByDisplayValue(`First${separator}Second`)).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is false', async () => {
    render(
      <Cascader displayAllSelectedLevels={false} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    await userEvent.click(await screen.findByText('First'));
    await userEvent.click(await screen.findByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is not passed in', async () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    await userEvent.click(await screen.findByText('First'));
    await userEvent.click(await screen.findByText('Second'));

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
});
