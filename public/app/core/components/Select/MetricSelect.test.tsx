import { render, screen } from '@testing-library/react';
import React from 'react';
import { select, openMenu } from 'react-select-event';

import { MetricSelect, Props } from './MetricSelect';

const props: Props = {
  isSearchable: false,
  onChange: jest.fn(),
  value: '',
  placeholder: 'Select Reducer',
  className: 'width-15',
  options: [
    {
      label: 'foo',
      value: 'foo',
    },
    {
      label: 'bar',
      value: 'bar',
    },
  ],
  variables: [],
};

describe('MetricSelect', () => {
  it('passes the placeholder, options and onChange correctly to Select', async () => {
    render(<MetricSelect {...props} />);
    const metricSelect = screen.getByRole('combobox');
    expect(metricSelect).toBeInTheDocument();
    expect(screen.getByText('Select Reducer')).toBeInTheDocument();

    await select(metricSelect, 'foo', {
      container: document.body,
    });
    expect(props.onChange).toHaveBeenCalledWith('foo');
  });

  it('has the correct noOptionsMessage', () => {
    const propsWithoutOptions = {
      ...props,
      options: [],
    };
    render(<MetricSelect {...propsWithoutOptions} />);

    const metricSelect = screen.getByRole('combobox');
    expect(metricSelect).toBeInTheDocument();

    openMenu(metricSelect);
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });
});
