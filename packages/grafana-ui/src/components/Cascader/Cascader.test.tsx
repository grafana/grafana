import { act, render, screen } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';

import { Cascader, CascaderOption, CascaderProps } from './Cascader';

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

      expect(screen.getByText('Initial state option')).toBeInTheDocument();
      expect(screen.queryByText('First')).not.toBeInTheDocument();

      act(() => {
        jest.runAllTimers();
      });

      await user.click(screen.getByPlaceholderText(placeholder));

      expect(screen.queryByText('Initial state option')).not.toBeInTheDocument();
      expect(screen.getByText('First')).toBeInTheDocument();
    });

    it('filters updated results when searching', async () => {
      render(<CascaderWithOptionsStateUpdate placeholder={placeholder} onSelect={jest.fn()} />);

      act(() => {
        jest.runAllTimers();
      });

      await user.type(screen.getByPlaceholderText(placeholder), 'Third');
      expect(screen.queryByText('Second')).not.toBeInTheDocument();
      expect(screen.getByText('First / Third')).toBeInTheDocument();
    });
  });

  it('filters results when searching', async () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('First / Third')).toBeInTheDocument();
  });

  it('displays selected value with all levels when displayAllSelectedLevels is true and selecting a value from the search', async () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    await userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');
    await userEvent.click(screen.getByText('First / Third'));

    expect(screen.getByDisplayValue('First / Third')).toBeInTheDocument();
  });

  it('displays all levels selected with default separator when displayAllSelectedLevels is true', async () => {
    render(
      <Cascader displayAllSelectedLevels={true} placeholder={placeholder} options={options} onSelect={() => {}} />
    );

    expect(screen.queryByDisplayValue('First/Second')).not.toBeInTheDocument();

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(screen.getByText('First'), { pointerEventsCheck: PointerEventsCheckLevel.Never });
    await userEvent.click(screen.getByText('Second'), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    expect(screen.getByDisplayValue('First/Second')).toBeInTheDocument();
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
    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(screen.getByText('First'), { pointerEventsCheck: PointerEventsCheckLevel.Never });
    await userEvent.click(screen.getByText('Second'), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    expect(screen.getByDisplayValue(`First${separator}Second`)).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is false', async () => {
    render(
      <Cascader displayAllSelectedLevels={false} placeholder={placeholder} options={options} onSelect={jest.fn()} />
    );

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(screen.getByText('First'), { pointerEventsCheck: PointerEventsCheckLevel.Never });
    await userEvent.click(screen.getByText('Second'), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is not passed in', async () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={jest.fn()} />);

    await userEvent.click(screen.getByPlaceholderText(placeholder));
    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(screen.getByText('First'), { pointerEventsCheck: PointerEventsCheckLevel.Never });
    await userEvent.click(screen.getByText('Second'), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });
});
