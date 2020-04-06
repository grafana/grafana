import React from 'react';
import { shallow, mount } from 'enzyme';
import { SearchResults, Props } from './SearchResults';

const data = [
  {
    id: 2,
    uid: 'JB_zdOUWk',
    title: 'gdev dashboards',
    expanded: false,
    //@ts-ignore
    items: [],
    url: '/dashboards/f/JB_zdOUWk/gdev-dashboards',
    icon: 'folder',
    score: 0,
    checked: false,
  },
  {
    id: 0,
    title: 'General',
    items: [
      {
        id: 1,
        uid: 'lBdLINUWk',
        title: 'Test 1',
        uri: 'db/test1',
        url: '/d/lBdLINUWk/test1',
        slug: '',
        type: 'dash-db',
        //@ts-ignore
        tags: [],
        isStarred: false,
        checked: false,
      },
      {
        id: 46,
        uid: '8DY63kQZk',
        title: 'Test 2',
        uri: 'db/test2',
        url: '/d/8DY63kQZk/test2',
        slug: '',
        type: 'dash-db',
        tags: [],
        isStarred: false,
        checked: false,
      },
    ],
    icon: 'folder-open',
    score: 1,
    expanded: true,
    checked: false,
  },
];

const setup = (propOverrides?: Partial<Props>, renderMethod = shallow) => {
  const props: Props = {
    //@ts-ignore
    results: data,
    onSelectionChanged: () => {},
    onTagSelected: (name: string) => {},
    onFolderExpanding: () => {},
    onToggleSelection: () => {},
    editable: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = renderMethod(<SearchResults {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('SearchResults', () => {
  it('should render result items', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ 'aria-label': 'Search section' })).toHaveLength(2);
  });

  it('should render section items for expanded section', () => {
    const { wrapper } = setup();
    expect(wrapper.find({ 'aria-label': 'Search items' }).children()).toHaveLength(2);
  });

  it('should not render checkboxes for non-editable results', () => {
    //@ts-ignore
    const { wrapper } = setup({ editable: false }, mount);
    expect(wrapper.find({ type: 'checkbox' })).toHaveLength(0);
  });

  it('should render checkboxes for non-editable results', () => {
    //@ts-ignore
    const { wrapper } = setup({ editable: true }, mount);
    expect(wrapper.find({ type: 'checkbox' })).toHaveLength(4);
  });
});
