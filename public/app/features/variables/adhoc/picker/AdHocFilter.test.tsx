import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';

import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { AdHocVariableFilter } from '../../types';

import { AdHocFilter } from './AdHocFilter';

describe('AdHocFilter', () => {
  it('renders filters', async () => {
    setup();
    expect(screen.getByText('key1')).toBeInTheDocument();
    expect(screen.getByText('val1')).toBeInTheDocument();
    expect(screen.getByText('key2')).toBeInTheDocument();
    expect(screen.getByText('val2')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Filter')).toBeInTheDocument();
  });

  it('adds filter', async () => {
    const { addFilter } = setup();

    // Select key
    await userEvent.click(screen.getByLabelText('Add Filter'));
    const selectEl = screen.getByTestId('AdHocFilterKey-add-key-wrapper');
    expect(selectEl).toBeInTheDocument();
    await selectEvent.select(selectEl, 'key3', { container: document.body });

    // Select value
    await userEvent.click(screen.getByText('Select value'));
    // There are already some filters rendered
    const selectEl2 = screen.getAllByTestId('AdHocFilterValue-value-wrapper')[2];
    await selectEvent.select(selectEl2, 'val3', { container: document.body });

    // Only after value is selected the addFilter is called
    expect(addFilter).toBeCalled();
  });

  it('removes filter', async () => {
    const { removeFilter } = setup();

    // Select key
    await userEvent.click(screen.getByText('key1'));
    const selectEl = screen.getAllByTestId('AdHocFilterKey-key-wrapper')[0];
    expect(selectEl).toBeInTheDocument();
    await selectEvent.select(selectEl, '-- remove filter --', { container: document.body });

    // Only after value is selected the addFilter is called
    expect(removeFilter).toBeCalled();
  });

  it('changes filter', async () => {
    const { changeFilter } = setup();

    // Select key
    await userEvent.click(screen.getByText('val1'));
    const selectEl = screen.getAllByTestId('AdHocFilterValue-value-wrapper')[0];
    expect(selectEl).toBeInTheDocument();
    await selectEvent.select(selectEl, 'val4', { container: document.body });

    // Only after value is selected the addFilter is called
    expect(changeFilter).toBeCalled();
  });
});

function setup() {
  setDataSourceSrv({
    get() {
      return {
        getTagKeys() {
          return [{ text: 'key3' }];
        },
        getTagValues() {
          return [{ text: 'val3' }, { text: 'val4' }];
        },
      };
    },
  } as unknown as DataSourceSrv);

  const filters: AdHocVariableFilter[] = [
    {
      key: 'key1',
      operator: '=',
      value: 'val1',
      condition: '',
    },
    {
      key: 'key2',
      operator: '=',
      value: 'val2',
      condition: '',
    },
  ];
  const addFilter = jest.fn();
  const removeFilter = jest.fn();
  const changeFilter = jest.fn();

  render(
    <AdHocFilter
      datasource={{ uid: 'test' }}
      filters={filters}
      addFilter={addFilter}
      removeFilter={removeFilter}
      changeFilter={changeFilter}
    />
  );

  return { addFilter, removeFilter, changeFilter };
}
