import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line lodash/import-scope
import lodash from 'lodash';
import selectEvent from 'react-select-event';

import { ResourceResponse, LogGroupResponse } from '../../../resources/types';

import { LogGroupsSelector } from './LogGroupsSelector';

const defaultProps = {
  variables: [],
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
        accountId: '123',
        value: {
          name: 'logGroup1',
          arn: 'arn:partition:service:region:account-id123:loggroup:someloggroup',
        },
      },
      {
        accountId: '456',
        value: {
          name: 'logGroup2',
          arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
        },
      },
    ] as Array<ResourceResponse<LogGroupResponse>>),
  onChange: jest.fn(),
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

describe('LogGroupsSelector', () => {
  beforeEach(() => {
    lodash.debounce = jest.fn().mockImplementation((fn) => {
      fn.cancel = () => {};
      return fn;
    });
  });
  afterEach(() => {
    lodash.debounce = originalDebounce;
  });
  it('opens a modal with a search field when the Select log groups Button is clicked', async () => {
    render(<LogGroupsSelector {...defaultProps} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
  });

  it('calls fetchLogGroups the first time the modal opens and renders a loading widget and then a checkbox for every log group', async () => {
    const defer = new Deferred();
    const fetchLogGroups = jest.fn(async () => {
      await Promise.all([defer.promise]);
      return defaultProps.fetchLogGroups();
    });
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
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
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    defer.resolve();
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    expect(fetchLogGroups).toBeCalledTimes(1);
    expect(screen.queryAllByRole('checkbox').length).toBe(0);
    expect(screen.getByText('No log groups found')).toBeInTheDocument();
  });

  it('calls fetchLogGroups with a search phrase when it is typed in the Search Field', async () => {
    const fetchLogGroups = jest.fn(() => defaultProps.fetchLogGroups());
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
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
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
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
    render(<LogGroupsSelector {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
    expect(screen.getByLabelText('logGroup2')).not.toBeChecked();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    expect(screen.getByLabelText('logGroup2')).toBeChecked();
  });

  it('calls onChange with the selected log group when checked and the user clicks the Add button', async () => {
    const onChange = jest.fn();
    render(<LogGroupsSelector {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    await userEvent.click(screen.getByText('Add log groups'));
    expect(onChange).toHaveBeenCalledWith([
      {
        name: 'logGroup2',
        arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
        accountId: '456',
        accountLabel: undefined,
      },
    ]);
  });

  it('does not call onChange after a selection if the user hits the cancel button', async () => {
    const onChange = jest.fn();
    render(<LogGroupsSelector {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('logGroup2'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(onChange).not.toHaveBeenCalledWith([
      {
        name: 'logGroup2',
        arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
        accountId: '456',
        accountLabel: undefined,
      },
    ]);
  });

  const labelText =
    'Only the first 50 results can be shown. If you do not see an expected log group, try narrowing down your search.';
  it('should not display max result info label in case less than 50 logs groups are being displayed', async () => {
    const defer = new Deferred();
    const fetchLogGroups = jest.fn(async () => {
      await Promise.all([defer.promise]);
      return [];
    });
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.queryByText(labelText)).not.toBeInTheDocument();
    defer.resolve();
    await waitFor(() => expect(screen.queryByText(labelText)).not.toBeInTheDocument());
  });

  it('should display max result info label in case 50 or more logs groups are being displayed', async () => {
    const defer = new Deferred();
    const fetchLogGroups = jest.fn(async () => {
      await Promise.all([defer.promise]);
      return Array(50).map((i) => ({
        value: {
          arn: `logGroup${i}`,
          name: `logGroup${i}`,
        },
      }));
    });
    render(<LogGroupsSelector {...defaultProps} fetchLogGroups={fetchLogGroups} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.queryByText(labelText)).not.toBeInTheDocument();
    defer.resolve();
    await waitFor(() => expect(screen.getByText(labelText)).toBeInTheDocument());
  });

  it('should display log groups counter label', async () => {
    render(<LogGroupsSelector {...defaultProps} selectedLogGroups={[]} />);
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() => expect(screen.getByText('0 log groups selected')).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText('logGroup2'));
    await waitFor(() => expect(screen.getByText('1 log group selected')).toBeInTheDocument());
  });

  it('should not include selected template variables in the counter label', async () => {
    render(
      <LogGroupsSelector
        {...defaultProps}
        selectedLogGroups={[
          { name: 'logGroup1', arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup' },
          { name: '$logGroupVariable', arn: '$logGroupVariable' },
        ]}
      />
    );
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() => expect(screen.getByText('1 log group selected')).toBeInTheDocument());
  });

  it('should be possible to select a template variable and add it to selected log groups when the user clicks the Add button', async () => {
    const onChange = jest.fn();
    render(
      <LogGroupsSelector
        {...defaultProps}
        selectedLogGroups={[
          { name: 'logGroup1', arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup' },
        ]}
        variables={['$regionVariable', '$logGroupVariable']}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByText('Select log groups'));
    await selectEvent.select(screen.getByLabelText('Template variable'), '$logGroupVariable', {
      container: document.body,
    });
    await userEvent.click(screen.getByText('Add log groups'));
    expect(onChange).toHaveBeenCalledWith([
      {
        arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
        name: 'logGroup1',
      },
      {
        arn: '$logGroupVariable',
        name: '$logGroupVariable',
      },
    ]);
  });

  it('should be possible to remove template variable from selected log groups', async () => {
    const onChange = jest.fn();
    render(
      <LogGroupsSelector
        {...defaultProps}
        selectedLogGroups={[
          { name: 'logGroup1', arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup' },
        ]}
        variables={['$regionVariable', '$logGroupVariable']}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByText('Select log groups'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    await userEvent.click(screen.getByText('Add log groups'));
    expect(onChange).toHaveBeenCalledWith([
      {
        arn: 'arn:partition:service:region:account-id456:loggroup:someotherloggroup',
        name: 'logGroup1',
      },
    ]);
  });

  it('should display account label if account options prop has values', async () => {
    render(<LogGroupsSelector {...defaultProps} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
    expect(screen.getByText('Account label')).toBeInTheDocument();
    waitFor(() => expect(screen.getByText('Account Name 123')).toBeInTheDocument());
  });

  it('should not display account label if account options prop doesnt has values', async () => {
    render(<LogGroupsSelector {...defaultProps} accountOptions={[]} />);
    await userEvent.click(screen.getByText('Select log groups'));
    expect(screen.getByText('Log group name prefix')).toBeInTheDocument();
    expect(screen.queryByText('Account label')).not.toBeInTheDocument();
    waitFor(() => expect(screen.queryByText('Account Name 123')).not.toBeInTheDocument());
  });
});
