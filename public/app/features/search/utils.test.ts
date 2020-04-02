import { getFlattenedSections } from './utils';
import { DashboardSection } from './types';

const sections = [
  {
    title: 'Starred',
    score: -2,
    expanded: true,
    items: [
      {
        id: 1,
        uid: 'lBdLINUWk',
        title: 'Prom dash',
        type: 'dash-db',
      },
    ],
  },
  {
    title: 'Recent',
    icon: 'clock-o',
    score: -1,
    removable: true,
    expanded: false,
    items: [
      {
        id: 4072,
        uid: 'OzAIf_rWz',
        title: 'New dashboard Copy 3',

        type: 'dash-db',
        isStarred: false,
      },
      {
        id: 46,
        uid: '8DY63kQZk',
        title: 'Stocks',
        type: 'dash-db',
        isStarred: false,
      },
      {
        id: 20,
        uid: '7MeksYbmk',
        title: 'Alerting with TestData',
        type: 'dash-db',
        isStarred: false,
        folderId: 2,
      },
      {
        id: 4073,
        uid: 'j9SHflrWk',
        title: 'New dashboard Copy 4',
        type: 'dash-db',
        isStarred: false,
        folderId: 2,
      },
    ],
  },
  {
    id: 2,
    uid: 'JB_zdOUWk',
    title: 'gdev dashboards',
    expanded: false,
    url: '/dashboards/f/JB_zdOUWk/gdev-dashboards',
    icon: 'folder',
    score: 2,
    //@ts-ignore
    items: [],
  },
  {
    id: 2568,
    uid: 'search-test-data',
    title: 'Search test data folder',
    expanded: false,
    items: [],
    url: '/dashboards/f/search-test-data/search-test-data-folder',
    icon: 'folder',
    score: 3,
  },
  {
    id: 4074,
    uid: 'iN5TFj9Zk',
    title: 'Test',
    expanded: false,
    items: [],
    url: '/dashboards/f/iN5TFj9Zk/test',
    icon: 'folder',
    score: 4,
  },
  {
    id: 0,
    title: 'General',
    icon: 'folder-open',
    score: 5,
    expanded: true,
    items: [
      {
        id: 4069,
        uid: 'LCFWfl9Zz',
        title: 'New dashboard Copy',
        uri: 'db/new-dashboard-copy',
        url: '/d/LCFWfl9Zz/new-dashboard-copy',
        slug: '',
        type: 'dash-db',
        isStarred: false,
      },
      {
        id: 4072,
        uid: 'OzAIf_rWz',
        title: 'New dashboard Copy 3',
        type: 'dash-db',
        isStarred: false,
      },
      {
        id: 1,
        uid: 'lBdLINUWk',
        title: 'Prom dash',
        type: 'dash-db',
        isStarred: true,
      },
    ],
  },
];

describe('Search utils', () => {
  describe('getFlattenedSections', () => {
    it('should return an array of items plus children for expanded items', () => {
      const flatSections = getFlattenedSections(sections as DashboardSection[]);
      expect(flatSections).toHaveLength(10);
      expect(flatSections).toEqual([
        'Starred',
        'Starred-1',
        'Recent',
        '2',
        '2568',
        '4074',
        '0',
        '0-4069',
        '0-4072',
        '0-1',
      ]);
    });
  });
});
