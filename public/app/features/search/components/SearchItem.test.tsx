import React from 'react';
import { shallow, mount } from 'enzyme';
import { SearchItem, Props } from './SearchItem';
import { Tag } from '@grafana/ui';

const data = {
  id: 1,
  uid: 'lBdLINUWk',
  title: 'Test 1',
  uri: 'db/test1',
  url: '/d/lBdLINUWk/test1',
  slug: '',
  type: 'dash-db',
  //@ts-ignore
  tags: ['Tag1', 'Tag2'],
  isStarred: false,
  checked: false,
};

const setup = (propOverrides?: Partial<Props>, renderMethod = shallow) => {
  const props: Props = {
    item: data,
    onToggleSelection: jest.fn(),
    onTagSelected: jest.fn(),
    editable: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = renderMethod(<SearchItem {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('SearchItem', () => {
  it('should render the item', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ 'aria-label': 'Dashboard search item Test 1' })).toHaveLength(1);
    expect(wrapper.findWhere(comp => comp.type() === 'div' && comp.text() === 'Test 1')).toHaveLength(1);
  });

  it("should render item's tags", () => {
    // @ts-ignore
    const { wrapper } = setup({}, mount);
    expect(wrapper.find(Tag)).toHaveLength(2);
  });
});
