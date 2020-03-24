import React from 'react';
import { shallow } from 'enzyme';
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
        title: 'Prom dash',
        uri: 'db/prom-dash',
        url: '/d/lBdLINUWk/prom-dash',
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
        title: 'Stocks',
        uri: 'db/stocks',
        url: '/d/8DY63kQZk/stocks',
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
});
