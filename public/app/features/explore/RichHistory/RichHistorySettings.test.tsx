import React from 'react';
import { mount } from 'enzyme';
import { RichHistorySettings, RichHistorySettingsProps } from './RichHistorySettings';

const setup = (propOverrides?: Partial<RichHistorySettingsProps>) => {
  const props: RichHistorySettingsProps = {
    retentionPeriod: 14,
    starredTabAsFirstTab: true,
    activeDatasourceOnly: false,
    onChangeRetentionPeriod: jest.fn(),
    toggleStarredTabAsFirstTab: jest.fn(),
    toggleactiveDatasourceOnly: jest.fn(),
    deleteRichHistory: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistorySettings {...props} />);
  return wrapper;
};

describe('RichHistorySettings', () => {
  it('whould render without errors', () => {
    setup();
  });
  it('should render component with correct retention period', () => {
    const wrapper = setup();
    expect(wrapper.html()).toContain('2 weeks');
  });
  it('should render component with correctly checked starredTabAsFirstTab settings', () => {
    const wrapper = setup();
    expect(wrapper.html()).toContain('<input type="checkbox" id="switch-5" checked="">');
  });
  it('should render component with correctly not checked toggleactiveDatasourceOnly settings', () => {
    const wrapper = setup();
    expect(wrapper.html()).toContain('<input type="checkbox" id="switch-8">');
  });
});
