import React from 'react';
import { mount } from 'enzyme';
import { GrafanaTheme } from '@grafana/data';
import { ExploreId } from '../../../types/explore';
import { RichHistory, RichHistoryProps } from './RichHistory';
import { Tabs } from './RichHistory';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<RichHistoryProps>) => {
  const props: RichHistoryProps = {
    theme: {} as GrafanaTheme,
    exploreId: ExploreId.left,
    activeDatasourceInstance: 'Test datasource',
    richHistory: [],
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<RichHistory {...props} />);
  return wrapper;
};

describe('RichHistory', () => {
  it('should render component without errors', () => {
    setup();
  });
  it('should correctly render all tabs in tab bar', () => {
    const wrapper = setup();
    expect(wrapper.html()).toContain('Query history');
    expect(wrapper.html()).toContain('Starred');
    expect(wrapper.html()).toContain('Settings');
  });
  it('should correctly render query history tab as active tab', () => {
    const wrapper = setup();
    expect(wrapper.html()).toContain('slider');
  });
  it('should correctly render starred tab as active tab', () => {
    const wrapper = setup({ firstTab: Tabs.Starred });
    expect(wrapper.html()).not.toContain('slider');
  });
});
