import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lodash from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { toOption } from '@grafana/data';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { DescribeLogGroupsRequest } from '../types';

import { LogGroupSelector, LogGroupSelectorProps } from './LogGroupSelector';

const ds = setupMockedDataSource();

describe('LogGroupSelector', () => {
  const onChange = jest.fn();
  const defaultProps: LogGroupSelectorProps = {
    region: 'region1',
    datasource: ds.datasource,
    selectedLogGroups: [],
    onChange,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('does not clear previously selected log groups after region change', async () => {
    ds.datasource.api.describeLogGroups = jest.fn().mockImplementation(async (params: DescribeLogGroupsRequest) => {
      if (params.region === 'region1') {
        return Promise.resolve(['log_group_1'].map(toOption));
      } else {
        return Promise.resolve(['log_group_2'].map(toOption));
      }
    });
    const props = {
      ...defaultProps,
      selectedLogGroups: ['log_group_1'],
    };

    const { rerender } = render(<LogGroupSelector {...props} />);
    expect(await screen.findByText('log_group_1')).toBeInTheDocument();

    act(() => rerender(<LogGroupSelector {...props} region="region2" />));
    expect(await screen.findByText('log_group_1')).toBeInTheDocument();
  });

  it('should merge results of remote log groups search with existing results', async () => {
    lodash.debounce = jest.fn().mockImplementation((fn) => fn);
    const allLogGroups = [
      'AmazingGroup',
      'AmazingGroup2',
      'AmazingGroup3',
      'BeautifulGroup',
      'BeautifulGroup2',
      'BeautifulGroup3',
      'CrazyGroup',
      'CrazyGroup2',
      'CrazyGroup3',
      'DeliciousGroup',
      'DeliciousGroup2',
      'DeliciousGroup3',
      'VelvetGroup',
      'VelvetGroup2',
      'VelvetGroup3',
      'WaterGroup',
      'WaterGroup2',
      'WaterGroup3',
    ];
    const testLimit = 10;

    ds.datasource.api.describeLogGroups = jest.fn().mockImplementation(async (params: DescribeLogGroupsRequest) => {
      const theLogGroups = allLogGroups
        .filter((logGroupName) => logGroupName.startsWith(params.logGroupNamePrefix ?? ''))
        .slice(0, Math.max(params.limit ?? testLimit, testLimit));
      return Promise.resolve(theLogGroups.map(toOption));
    });
    const props = {
      ...defaultProps,
    };
    render(<LogGroupSelector {...props} />);
    const multiselect = await screen.findByLabelText('Log Groups');

    // Adds the 3 Water groups to the 10 loaded in initially
    await userEvent.type(multiselect, 'Water');
    // The 3 Water groups + the create option
    expect(screen.getAllByLabelText('Select option').length).toBe(4);
    await userEvent.clear(multiselect);
    expect(screen.getAllByLabelText('Select option').length).toBe(testLimit + 3);

    // Adds the three Velvet groups to the previous 13
    await userEvent.type(multiselect, 'Velv');
    // The 3 Velvet groups + the create option
    expect(screen.getAllByLabelText('Select option').length).toBe(4);
    await userEvent.clear(multiselect);
    expect(screen.getAllByLabelText('Select option').length).toBe(testLimit + 6);
  });

  it('should render template variables a selectable option', async () => {
    lodash.debounce = jest.fn().mockImplementation((fn) => fn);
    ds.datasource.api.describeLogGroups = jest.fn().mockResolvedValue([]);
    const onChange = jest.fn();
    const props = {
      ...defaultProps,
      onChange,
    };
    render(<LogGroupSelector {...props} />);

    const logGroupSelector = await screen.findByLabelText('Log Groups');
    expect(logGroupSelector).toBeInTheDocument();

    await openMenu(logGroupSelector);
    const templateVariableSelector = await screen.findByText('Template Variables');
    expect(templateVariableSelector).toBeInTheDocument();

    userEvent.click(templateVariableSelector);
    await select(await screen.findByLabelText('Select option'), 'test');

    expect(onChange).toBeCalledWith(['test']);
  });
});
