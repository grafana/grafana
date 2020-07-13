import React from 'react';
import { shallow } from 'enzyme';
import { DerivedField } from './DerivedField';
import DataSourcePicker from '../../../../core/components/Select/DataSourcePicker';
import { DataSourceInstanceSettings } from '@grafana/data';

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv() {
    return {
      getExternal(): DataSourceInstanceSettings[] {
        return [
          {
            id: 1,
            uid: 'metrics',
            name: 'metrics_ds',
            meta: {
              tracing: false,
            } as any,
          } as any,

          {
            id: 2,
            uid: 'tracing',
            name: 'tracing_ds',
            meta: {
              tracing: true,
            } as any,
          } as any,
        ];
      },
    };
  },
}));

describe('DerivedField', () => {
  it('shows internal link if uid is set', () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    const wrapper = shallow(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);

    expect(
      wrapper
        .find('DataSourceSection')
        .dive()
        .find(DataSourcePicker).length
    ).toBe(1);
  });

  it('shows url link if uid is not set', () => {
    const value = {
      matcherRegex: '',
      name: '',
      url: 'test',
    };
    const wrapper = shallow(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(wrapper.find('DataSourceSection').length).toBe(0);
  });

  it('shows only tracing datasources for internal link', () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    const wrapper = shallow(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    const dsSection = wrapper.find('DataSourceSection').dive();
    expect(dsSection.find(DataSourcePicker).props().datasources).toEqual([
      {
        meta: { tracing: true },
        name: 'tracing_ds',
        value: 'tracing',
      },
    ]);
  });
});
