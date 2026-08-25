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

describe('Cascader', () => {
  const placeholder = 'cascader-placeholder';

  describe('options updates', () => {
    it('displays updated options', async () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <Cascader options={initialOptions} placeholder={placeholder} onSelect={onSelect} />
      );

      await userEvent.click(screen.getByPlaceholderText(placeholder));

      expect(await screen.findByText('Initial state option')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();

      rerender(<Cascader options={options} placeholder={placeholder} onSelect={onSelect} />);

      expect(screen.queryByText('Initial state option')).not.toBeInTheDocument();
      expect(await screen.findByText('First')).toBeInTheDocument();
    });

    it('filters updated results when searching', async () => {
      const onSelect = jest.fn();
      const { rerender } = render(
        <Cascader options={initialOptions} placeholder={placeholder} onSelect={onSelect} />
      );
      rerender(<Cascader options={options} placeholder={placeholder} onSelect={onSelect} />);

      await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
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
});
