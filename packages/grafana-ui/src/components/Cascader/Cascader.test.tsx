import React from 'react';
import { Cascader, CascaderOption, CascaderProps } from './Cascader';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

const CascaderWithOptionsStateUpdate = (props: Omit<CascaderProps, 'options'>) => {
  const [updatedOptions, setOptions] = React.useState<CascaderOption[]>([
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
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('displays updated options', () => {
      render(<CascaderWithOptionsStateUpdate placeholder={placeholder} onSelect={jest.fn()} />);

      userEvent.click(screen.getByPlaceholderText(placeholder));

      expect(screen.getByText('Initial state option')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();

      act(() => {
        jest.runAllTimers();
      });

      userEvent.click(screen.getByPlaceholderText(placeholder));
      expect(screen.queryByText('Initial state option')).not.toBeInTheDocument();
      expect(screen.getByText('First')).toBeInTheDocument();
    });

    it('filters updated results when searching', () => {
      render(<CascaderWithOptionsStateUpdate placeholder={placeholder} onSelect={jest.fn()} />);

      act(() => {
        jest.runAllTimers();
      });

      userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
      expect(screen.getByText('First / Third')).toBeInTheDocument();
    });
  });

  it('filters results when searching', () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('First / Third')).toBeInTheDocument();
  });

  it('displays selected value with all levels when displayAllSelectedLevels is true and selecting a value from the search', () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
    userEvent.click(screen.getByText('First / Third'));

    expect(screen.getByDisplayValue('First / Third')).toBeInTheDocument();
  });

  it('displays all levels selected with default separator when displayAllSelectedLevels is true', () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={() => {}} />
    );

    expect(screen.queryByDisplayValue('First/Second')).not.toBeInTheDocument();

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('First/Second')).toBeInTheDocument();
  });

  it('displays all levels selected with separator passed in when displayAllSelectedLevels is true', () => {
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

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue(`First${separator}Second`)).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is false', () => {
    render(
      <Cascader displayAllSelectedLevels={false} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is not passed in', () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });
});
