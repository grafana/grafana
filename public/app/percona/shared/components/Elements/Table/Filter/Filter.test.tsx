import { fireEvent, render, screen } from '@testing-library/react';

import { CheckDetails } from 'app/percona/check/types';

import { ExtendedColumn, FilterFieldTypes } from '..';

import { Filter } from './Filter';
import { SEARCH_INPUT_FIELD_NAME, SEARCH_SELECT_FIELD_NAME } from './Filter.constants';
import * as filterUtils from './Filter.utils';

const Messages = {
  name: 'Name',
  description: 'Description',
  enabled: 'Status',
  interval: 'Interval',
};

const columns: Array<ExtendedColumn<CheckDetails>> = [
  {
    Header: Messages.name,
    accessor: 'summary',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.description,
    accessor: 'description',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.enabled,
    accessor: 'enabled',
    type: FilterFieldTypes.RADIO_BUTTON,
    label: 'Test',
    options: [
      {
        label: 'Enabled',
        value: true,
      },
      {
        label: 'Disabled',
        value: false,
      },
    ],
  },
  {
    Header: Messages.interval,
    accessor: 'interval',
    type: FilterFieldTypes.DROPDOWN,
    options: [
      {
        label: 'Standard',
        value: 'Standard',
      },
      {
        label: 'Rare',
        value: 'Rare',
      },
      {
        label: 'Frequent',
        value: 'Frequent',
      },
    ],
  },
];

const data = [
  {
    name: 'test1',
    description: 'Test desctiption 1',
    summary: 'Test summary 1',
    interval: 'interval 1',
    enabled: true,
  },
  {
    name: 'test2',
    description: 'Test desctiption 2',
    summary: 'Test summary 2',
    interval: 'interval 2',
    enabled: true,
  },
  {
    name: 'test3',
    description: 'Test desctiption 3',
    summary: 'Test summary 3',
    interval: 'interval 3',
    enabled: false,
  },
];

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: () => ({
    pathname: 'http://localhost/graph/pmm-database-checks/all-checks',
  }),
}));

const setFilteredData = jest.fn();

describe('Filter', () => {
  beforeEach(() => {
    // There's a warning about keys coming from within ReactFinalForm
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render the filter', async () => {
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);
    expect(screen.getByTestId('advance-filter-button')).toBeInTheDocument();
    expect(screen.getByTestId('clear-all-button')).toBeInTheDocument();
    expect(screen.getByTestId('filter')).toBeInTheDocument();
  });

  it('should open correctly text fields', async () => {
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);

    fireEvent.click(screen.getByTestId('open-search-fields'));
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
  });

  it('should correctly show init data in text fields from url query', async () => {
    jest
      .spyOn(filterUtils, 'getQueryParams')
      .mockImplementation(() => ({ [SEARCH_SELECT_FIELD_NAME]: 'summary', [SEARCH_INPUT_FIELD_NAME]: 'data' }));
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
    expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toHaveValue('data');
  });

  it('should correctly show init data in advance filter fields from url query', async () => {
    jest.spyOn(filterUtils, 'getQueryParams').mockImplementation(() => ({ enabled: 'false', interval: 'Rare' }));
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);

    expect(screen.getByText('Rare')).toBeInTheDocument();
    expect(screen.getByTestId('enabled-radio-state')).toBeInTheDocument();
    expect(screen.getByTestId('enabled-radio-state')).toHaveValue('false');
  });

  it('should show only text fields when only text fields are set', async () => {
    jest
      .spyOn(filterUtils, 'getQueryParams')
      .mockImplementation(() => ({ [SEARCH_SELECT_FIELD_NAME]: 'summary', [SEARCH_INPUT_FIELD_NAME]: 'data' }));
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId(SEARCH_INPUT_FIELD_NAME)).toBeInTheDocument();
    expect(screen.queryByText('Rare')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enabled-radio-state')).not.toBeInTheDocument();
  });

  it('should show only advance filter fields when only advance filter fields are set', async () => {
    jest.spyOn(filterUtils, 'getQueryParams').mockImplementation(() => ({ enabled: 'false', interval: 'Rare' }));
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={false} />);

    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByTestId(SEARCH_INPUT_FIELD_NAME)).not.toBeInTheDocument();
    expect(screen.getByText('Rare')).toBeInTheDocument();
    expect(screen.getByTestId('enabled-radio-state')).toBeInTheDocument();
  });

  it('should show apply button when backend filtering is enabled', async () => {
    render(<Filter columns={columns} rawData={data} setFilteredData={setFilteredData} hasBackendFiltering={true} />);
    expect(screen.queryByTestId('submit-button'));
  });
});
