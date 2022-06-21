import { shallow, mount } from 'enzyme';
import React from 'react';

import { TabsBar } from '@grafana/ui';
import { TabsVertical } from 'app/percona/shared/components/Elements/TabsVertical/TabsVertical';

import { ContentTab, TabOrientation } from '../TabbedContent.types';

import { OrientedTabs } from './OrientedTabs';

describe('OrientedTabs', () => {
  it('should return TabsBar by default', () => {
    const wrapper = shallow(<OrientedTabs tabs={[]} />);
    expect(wrapper.find(TabsBar).exists()).toBeTruthy();
    expect(wrapper.find(TabsVertical).exists()).toBeFalsy();
  });

  it('should return TabsVertical when vertical orientation is passed', () => {
    const wrapper = shallow(<OrientedTabs orientation={TabOrientation.Vertical} tabs={[]} />);
    expect(wrapper.find(TabsBar).exists()).toBeFalsy();
    expect(wrapper.find(TabsVertical).exists()).toBeTruthy();
  });

  it('should call tabClick', () => {
    const tabs: ContentTab[] = [{ label: 'label', key: 'tab_1', component: <></> }];
    const spy = jest.fn();
    const wrapper = mount(<OrientedTabs tabs={tabs} tabClick={spy} />);
    const tabEl = wrapper.find('li');
    tabEl.simulate('click');

    expect(spy).toHaveBeenCalledWith('tab_1');
  });
});
