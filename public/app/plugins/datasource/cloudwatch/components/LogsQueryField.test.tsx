import React from 'react';
import { shallow } from 'enzyme';
import { CloudWatchLogsQueryField } from './LogsQueryField';
import { ExploreId } from '../../../../types';

describe('CloudWatchLogsQueryField', () => {
  it('updates upstream query log groups on region change', async () => {
    const onChange = jest.fn();
    const wrapper = shallow(
      <CloudWatchLogsQueryField
        history={[]}
        absoluteRange={{ from: 1, to: 10 }}
        syntaxLoaded={false}
        syntax={{} as any}
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
          } as any
        }
        query={{} as any}
        onRunQuery={() => {}}
        onChange={onChange}
      />
    );
    const getRegionSelect = () => wrapper.find({ label: 'Region' }).props().inputEl;
    const getLogGroupSelect = () => wrapper.find({ label: 'Log Groups' }).props().inputEl;

    getLogGroupSelect().props.onChange([{ value: 'log_group_1' }]);
    expect(getLogGroupSelect().props.value.length).toBe(1);
    expect(getLogGroupSelect().props.value[0].value).toBe('log_group_1');

    // We select new region where the selected log group does not exist
    await getRegionSelect().props.onChange({ value: 'region2' });

    // We clear the select
    expect(getLogGroupSelect().props.value.length).toBe(0);
    // Make sure we correctly updated the upstream state
    expect(onChange.mock.calls[1][0]).toEqual({ region: 'region2', logGroupNames: [] });
  });
});
