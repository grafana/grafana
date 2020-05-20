import React from 'react';
import { mount } from 'enzyme';
import { Tag } from '@grafana/ui';
import { SearchItem, Props } from './SearchItem';
import { DashboardSearchItemType } from '../types';

const data = {
  id: 1,
  uid: 'lBdLINUWk',
  title: 'Test 1',
  uri: 'db/test1',
  url: '/d/lBdLINUWk/test1',
  slug: '',
  type: DashboardSearchItemType.DashDB,
  tags: ['Tag1', 'Tag2'],
  isStarred: false,
  checked: false,
};

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    item: data,
    onTagSelected: jest.fn(),
    editable: false,
    //@ts-ignore
    onToggleAllChecked: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<SearchItem {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('SearchItem', () => {
  it('should render the item', () => {
    const { wrapper } = setup({});
    expect(wrapper.find({ 'aria-label': 'Dashboard search item Test 1' })).toHaveLength(1);
    expect(wrapper.findWhere(comp => comp.type() === 'div' && comp.text() === 'Test 1')).toHaveLength(1);
  });

  it("should render item's tags", () => {
    // @ts-ignore
    const { wrapper } = setup({});
    expect(wrapper.find(Tag)).toHaveLength(2);
  });
});
