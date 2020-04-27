import React from 'react';
import { shallow } from 'enzyme';
import { DerivedField } from './DerivedField';
import DataSourcePicker from '../../../../core/components/Select/DataSourcePicker';

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv() {
    return {
      getExternal(): any[] {
        return [];
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
});
