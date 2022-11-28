import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import React from 'react';
import selectEvent from 'react-select-event';

import { CrossAccountLogsQueryField } from './CrossAccountLogsQueryField';

const defaultProps = {
  selectedLogGroups: [],
  accountOptions: [
    {
      value: 'account-id123',
      descriptions: 'account-id123',
      label: 'Account Name 123',
    },
    {
      value: 'account-id456',
      descriptions: 'account-id456',
      label: 'Account Name 456',
    },
  ],
  fetchLogGroups: () =>
    Promise.resolve([
      {
        label: 'logGroup1',
        text: 'logGroup1',
        value: 'arn:partition:service:region:account-id123:loggroup:someloggroup',
      },
      {
        label: 'logGroup2',
        text: 'logGroup2',
        value: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
      },
    ]),
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};

const originalDebounce = lodash.debounce;

class Deferred {
  promise: Promise<unknown>;
  resolve!: (value?: unknown) => void;
  reject: ((reason?: unknown) => void) | undefined;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

describe('CrossAccountLogsQueryField', () => {
  beforeEach(() => {
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });
  afterEach(() => {
    lodash.debounce = originalDebounce;
  });
  it('opens a modal with a search field when the Select Log Groups Button is clicked', async () => {
    render(<CrossAccountLogsQueryField {...defaultProps} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
  });

  it('calls fetchLogGroups the first time the modal opens and renders a loading widget and then a checkbox for every log group', async () => {
    const defer = new Deferred();
    const fetchLogGroups = jest.fn(async () => {
      await Promise.all([defer.promise]);
      return defaultProps.fetchLogGroups();
    });
    render(<CrossAccountLogsQueryField {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    defer.resolve();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(fetchLogGroups).toBeCalledTimes(1);
    expect(screen.getAllByRole('checkbox').length).toBe(2);
  });

  it('returns a no log groups found message when fetchLogGroups returns an empty array', async () => {
    const defer = new Deferred();
    const fetchLogGroups = jest.fn(async () => {
      await Promise.all([defer.promise]);
      return [];
    });
    render(<CrossAccountLogsQueryField {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    defer.resolve();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(fetchLogGroups).toBeCalledTimes(1);
    expect(screen.queryAllByRole('checkbox').length).toBe(0);
    expect(screen.getByText('No log groups found')).toBeInTheDocument();
  });

  it('calls fetchLogGroups with a search phrase when it is typed in the Search Field', async () => {
    const fetchLogGroups = jest.fn(() => defaultProps.fetchLogGroups());
    render(<CrossAccountLogsQueryField {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('log group search'), 'something');
    await waitFor(() => screen.getByDisplayValue('something'));
    expect(fetchLogGroups).toBeCalledWith({ accountId: 'all', logGroupPattern: 'something' });
  });

  it('calls fetchLogGroups with an account when selected', async () => {
    const firstCall = new Deferred();
    const secondCall = new Deferred();
    let once = false;
    const fetchLogGroups = jest.fn(async () => {
      if (once) {
        await Promise.all([secondCall.promise]);
        return defaultProps.fetchLogGroups();
      }
      await Promise.all([firstCall.promise]);
      once = true;
      return defaultProps.fetchLogGroups();
    });
    render(<CrossAccountLogsQueryField {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    firstCall.resolve();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(fetchLogGroups).toBeCalledTimes(1);
    expect(screen.getAllByRole('checkbox').length).toBe(2);
    await selectEvent.select(screen.getByLabelText('Account Selection'), 'Account Name 123', {
      container: document.body,
    });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    secondCall.resolve();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(fetchLogGroups).toBeCalledWith({ accountId: 'account-id123', logGroupPattern: '' });
  });

  it('shows a log group as checked after the user checks it', async () => {
    const onChange = jest.fn();
    render(<CrossAccountLogsQueryField {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
    expect(screen.getByLabelText('logGroup2')).not.toBeChecked();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    expect(screen.getByLabelText('logGroup2')).toBeChecked();
  });
  it('calls onChange with the selected log group when checked and the user clicks the Add button', async () => {
    const onChange = jest.fn();
    render(<CrossAccountLogsQueryField {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    await userEvent.click(screen.getByText('Add log groups'));
    expect(onChange).toHaveBeenCalledWith([
      {
        label: 'logGroup2',
        text: 'logGroup2',
        value: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
      },
    ]);
  });

  it('does not call onChange after a selection if the user hits the cancel button', async () => {
    const onChange = jest.fn();
    render(<CrossAccountLogsQueryField {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(onChange).not.toHaveBeenCalledWith([
      {
        label: 'logGroup2',
        text: 'logGroup2',
        value: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
      },
    ]);
  });

  it('runs the query on close of the modal', async () => {
    const onRunQuery = jest.fn();
    render(<CrossAccountLogsQueryField {...defaultProps} onRunQuery={onRunQuery} />);
    await userEvent.click(screen.getByText('Select Log Groups'));
    expect(screen.getByText('Log Group Name')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Close dialogue'));
    expect(onRunQuery).toBeCalledTimes(1);
  });
});
