import React from 'react';
import { Cascader } from './Cascader';
import { shallow } from 'enzyme';
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

const flatOptions = [
  {
    singleLabel: 'Second',
    label: 'First / Second',
    value: ['1', '2'],
  },
  {
    singleLabel: 'Third',
    label: 'First / Third',
    value: ['1', '3'],
  },
  {
    singleLabel: 'Fourth',
    label: 'First / Fourth',
    value: ['1', '4'],
  },
  {
    singleLabel: 'FirstFirst',
    label: 'FirstFirst',
    value: ['5'],
  },
];

describe('Cascader', () => {
  let cascader: any;
  beforeEach(() => {
    cascader = shallow(<Cascader options={options} onSelect={() => {}} />);
  });

  it('Should convert options to searchable strings', () => {
    expect(cascader.state('searchableOptions')).toEqual(flatOptions);
  });

  it('displays all levels selected with default separator when displayAllSelectedLevels is true', () => {
    const placeholder = 'cascader-placeholder';
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
    const placeholder = 'cascader-placeholder';
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
    const placeholder = 'cascader-placeholder';

    render(
      <Cascader displayAllSelectedLevels={false} placeholder={placeholder} options={options} onSelect={() => {}} />
    );

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('displays last level selected when displayAllSelectedLevels is not passed in', () => {
    const placeholder = 'cascader-placeholder';

    render(<Cascader placeholder={placeholder} options={options} onSelect={() => {}} />);

    userEvent.click(screen.getByPlaceholderText(placeholder));
    userEvent.click(screen.getByText('First'));
    userEvent.click(screen.getByText('Second'));

    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });
});
