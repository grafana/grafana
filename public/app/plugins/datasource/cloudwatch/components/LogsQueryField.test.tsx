import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { shallow } from 'enzyme';
import _, { DebouncedFunc } from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';
import { act } from 'react-dom/test-utils';
import { openMenu, select } from 'react-select-event';

import { SelectableValue } from '@grafana/data';

import { ExploreId } from '../../../../types';
import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { DescribeLogGroupsRequest } from '../types';

import { CloudWatchLogsQueryField } from './LogsQueryField';

jest
  .spyOn(_, 'debounce')
  .mockImplementation((func: (...args: any) => any, wait?: number) => func as DebouncedFunc<typeof func>);

describe('CloudWatchLogsQueryField', () => {
  it('runs onRunQuery on blur of Log Groups', async () => {
    const onRunQuery = jest.fn();
    const ds = setupMockedDataSource();

    render(
      <CloudWatchLogsQueryField
        absoluteRange={{ from: 1, to: 10 }}
        exploreId={ExploreId.left}
        datasource={ds.datasource}
        query={{} as any}
        onRunQuery={onRunQuery}
        onChange={() => {}}
      />
    );

    const multiSelect = screen.getByLabelText('Log Groups');
    await act(async () => {
      fireEvent.blur(multiSelect);
    });
    expect(onRunQuery).toHaveBeenCalled();
  });

  it('updates upstream query log groups on region change', async () => {
    const onChange = jest.fn();
    const wrapper = shallow(
      <CloudWatchLogsQueryField
        history={[]}
        absoluteRange={{ from: 1, to: 10 }}
        exploreId={ExploreId.left}
        datasource={
          {
            getRegions() {
              return Promise.resolve([
                {
                  label: 'region1',
                  value: 'region1',
                  text: 'region1',
                },
                {
                  label: 'region2',
                  value: 'region2',
                  text: 'region2',
                },
              ]);
            },
            describeLogGroups(params: any) {
              if (params.region === 'region1') {
                return Promise.resolve(['log_group_1']);
              } else {
                return Promise.resolve(['log_group_2']);
              }
            },
            getVariables: jest.fn().mockReturnValue([]),
          } as any
        }
        query={{} as any}
        onRunQuery={() => {}}
        onChange={onChange}
      />
    );
    const getLogGroupSelect = () => wrapper.find({ label: 'Log Groups' }).props().inputEl;

    getLogGroupSelect().props.onChange([{ value: 'log_group_1' }]);
    expect(getLogGroupSelect().props.value.length).toBe(1);
    expect(getLogGroupSelect().props.value[0].value).toBe('log_group_1');

    // We select new region where the selected log group does not exist
    await (wrapper.instance() as CloudWatchLogsQueryField).onRegionChange('region2');

    // We clear the select
    expect(getLogGroupSelect().props.value.length).toBe(0);
    // Make sure we correctly updated the upstream state
    expect(onChange).toHaveBeenLastCalledWith({ logGroupNames: [] });
  });

  it('should merge results of remote log groups search with existing results', async () => {
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
      'EnjoyableGroup',
      'EnjoyableGroup2',
      'EnjoyableGroup3',
      'FavouriteGroup',
      'FavouriteGroup2',
      'FavouriteGroup3',
      'GorgeousGroup',
      'GorgeousGroup2',
      'GorgeousGroup3',
      'HappyGroup',
      'HappyGroup2',
      'HappyGroup3',
      'IncredibleGroup',
      'IncredibleGroup2',
      'IncredibleGroup3',
      'JollyGroup',
      'JollyGroup2',
      'JollyGroup3',
      'KoolGroup',
      'KoolGroup2',
      'KoolGroup3',
      'LovelyGroup',
      'LovelyGroup2',
      'LovelyGroup3',
      'MagnificentGroup',
      'MagnificentGroup2',
      'MagnificentGroup3',
      'NiceGroup',
      'NiceGroup2',
      'NiceGroup3',
      'OddGroup',
      'OddGroup2',
      'OddGroup3',
      'PerfectGroup',
      'PerfectGroup2',
      'PerfectGroup3',
      'QuietGroup',
      'QuietGroup2',
      'QuietGroup3',
      'RestlessGroup',
      'RestlessGroup2',
      'RestlessGroup3',
      'SurpriseGroup',
      'SurpriseGroup2',
      'SurpriseGroup3',
      'TestingGroup',
      'TestingGroup2',
      'TestingGroup3',
      'UmbrellaGroup',
      'UmbrellaGroup2',
      'UmbrellaGroup3',
      'VelvetGroup',
      'VelvetGroup2',
      'VelvetGroup3',
      'WaterGroup',
      'WaterGroup2',
      'WaterGroup3',
      'XylophoneGroup',
      'XylophoneGroup2',
      'XylophoneGroup3',
      'YellowGroup',
      'YellowGroup2',
      'YellowGroup3',
      'ZebraGroup',
      'ZebraGroup2',
      'ZebraGroup3',
    ];

    const onChange = jest.fn();
    const wrapper = shallow<CloudWatchLogsQueryField>(
      <CloudWatchLogsQueryField
        history={[]}
        absoluteRange={{ from: 1, to: 10 }}
        exploreId={ExploreId.left}
        datasource={
          {
            getRegions() {
              return Promise.resolve([
                {
                  label: 'region1',
                  value: 'region1',
                  text: 'region1',
                },
                {
                  label: 'region2',
                  value: 'region2',
                  text: 'region2',
                },
              ]);
            },
            describeLogGroups(params: DescribeLogGroupsRequest) {
              const theLogGroups = allLogGroups
                .filter((logGroupName) => logGroupName.startsWith(params.logGroupNamePrefix ?? ''))
                .slice(0, Math.max(params.limit ?? 50, 50));
              return Promise.resolve(theLogGroups);
            },
            getVariables: jest.fn().mockReturnValue([]),
          } as any
        }
        query={{} as any}
        onRunQuery={() => {}}
        onChange={onChange}
      />
    );

    const initialAvailableGroups = allLogGroups
      .slice(0, 50)
      .map((logGroupName) => ({ value: logGroupName, label: logGroupName }));
    wrapper.setState({
      availableLogGroups: initialAvailableGroups,
    });

    await wrapper.instance().onLogGroupSearch('Water', 'default', { action: 'input-change' });

    let nextAvailableGroups = (wrapper.state('availableLogGroups') as Array<SelectableValue<string>>).map(
      (logGroup) => logGroup.value
    );
    expect(nextAvailableGroups).toEqual(
      initialAvailableGroups.map((logGroup) => logGroup.value).concat(['WaterGroup', 'WaterGroup2', 'WaterGroup3'])
    );

    await wrapper.instance().onLogGroupSearch('Velv', 'default', { action: 'input-change' });
    nextAvailableGroups = (wrapper.state('availableLogGroups') as Array<SelectableValue<string>>).map(
      (logGroup) => logGroup.value
    );
    expect(nextAvailableGroups).toEqual(
      initialAvailableGroups
        .map((logGroup) => logGroup.value)
        .concat(['WaterGroup', 'WaterGroup2', 'WaterGroup3', 'VelvetGroup', 'VelvetGroup2', 'VelvetGroup3'])
    );
  });

  it('should render template variables a selectable option', async () => {
    const { datasource } = setupMockedDataSource();
    const onChange = jest.fn();

    render(
      <CloudWatchLogsQueryField
        history={[]}
        absoluteRange={{ from: 1, to: 10 }}
        exploreId={ExploreId.left}
        datasource={datasource}
        query={{} as any}
        onRunQuery={() => {}}
        onChange={onChange}
      />
    );

    const logGroupSelector = await screen.findByLabelText('Log Groups');
    expect(logGroupSelector).toBeInTheDocument();

    await openMenu(logGroupSelector);
    const templateVariableSelector = await screen.findByText('Template Variables');
    expect(templateVariableSelector).toBeInTheDocument();

    userEvent.click(templateVariableSelector);
    await select(await screen.findByLabelText('Select option'), 'test');

    expect(await screen.findByText('test')).toBeInTheDocument();
  });
});
