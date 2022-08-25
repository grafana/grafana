import { shallow } from 'enzyme';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';

import { DerivedField } from './DerivedField';

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
            } as DataSourcePluginMeta,
          } as DataSourceInstanceSettings,

          {
            id: 2,
            uid: 'tracing',
            name: 'tracing_ds',
            meta: {
              tracing: true,
            } as DataSourcePluginMeta,
          } as DataSourceInstanceSettings,
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

    expect(wrapper.find(DataSourcePicker).length).toBe(1);
  });

  it('shows url link if uid is not set', () => {
    const value = {
      matcherRegex: '',
      name: '',
      url: 'test',
    };
    const wrapper = shallow(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(wrapper.find(DataSourcePicker).length).toBe(0);
  });

  it('shows only tracing datasources for internal link', () => {
    const value = {
      matcherRegex: '',
      name: '',
      datasourceUid: 'test',
    };
    const wrapper = shallow(<DerivedField value={value} onChange={() => {}} onDelete={() => {}} suggestions={[]} />);
    expect(wrapper.find(DataSourcePicker).props().tracing).toEqual(true);
  });
});
