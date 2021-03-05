import React from 'react';
import { Cascader } from './Cascader';
import { render, screen } from '@testing-library/react';
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

describe('Cascader', () => {
  const placeholder = 'cascader-placeholder';

  it('filters results when searching', () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={() => {}} />);

    userEvent.type(screen.getByPlaceholderText(placeholder), 'Third');

    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.getByText('First / Third')).toBeInTheDocument();
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
      <Cascader displayAllSelectedLevels={false} placeholder={placeholder} options={options} onSelect={() => {}} />
    );

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is not passed in', () => {
    render(<Cascader placeholder={placeholder} options={options} onSelect={() => {}} />);

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });
});
