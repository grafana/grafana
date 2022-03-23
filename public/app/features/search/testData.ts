import { DashboardSearchItemType, DashboardSection, DashboardSectionItem } from './types';

function makeSection(sectionPartial: Partial<DashboardSection>): DashboardSection {
  return {
    title: 'Default title',
    id: Number.MAX_SAFE_INTEGER - 1,
    score: -99,
    expanded: true,
    type: DashboardSearchItemType.DashFolder,
    items: [],
    url: '/default-url',
    ...sectionPartial,
  };
}

const makeSectionItem = (itemPartial: Partial<DashboardSectionItem>): DashboardSectionItem => {
  return {
    id: Number.MAX_SAFE_INTEGER - 2,
    uid: 'default-uid',
    title: 'Default dashboard title',
    type: DashboardSearchItemType.DashDB,
    isStarred: false,
    tags: [],
    uri: 'db/default-slug',
    url: '/d/default-uid/default-slug',
    ...itemPartial,
  };
};

export const generalFolder: DashboardSection = {
  id: 0,
  title: 'General',
  items: [
    {
      id: 1,
      uid: 'lBdLINUWk',
      title: 'Test 1',
      uri: 'db/test1',
      url: '/d/lBdLINUWk/test1',
      type: DashboardSearchItemType.DashDB,
      tags: [],
      isStarred: false,
      checked: true,
    },
    {
      id: 46,
      uid: '8DY63kQZk',
      title: 'Test 2',
      uri: 'db/test2',
      url: '/d/8DY63kQZk/test2',
      type: DashboardSearchItemType.DashDB,
      tags: [],
      isStarred: false,
      checked: true,
    },
  ],
  icon: 'folder-open',
  score: 1,
  expanded: true,
  checked: false,
  url: '',
  type: DashboardSearchItemType.DashFolder,
};

export const searchResults: DashboardSection[] = [
  {
    id: 2,
    uid: 'JB_zdOUWk',
    title: 'gdev dashboards',
    expanded: false,
    items: [],
    url: '/dashboards/f/JB_zdOUWk/gdev-dashboards',
    icon: 'folder',
    score: 0,
    checked: true,
    type: DashboardSearchItemType.DashFolder,
  },
  generalFolder,
];

// Search results with more info
export const sections: DashboardSection[] = [
  makeSection({
    title: 'Starred',
    score: -2,
    expanded: true,
    items: [
      makeSectionItem({
        id: 1,
        uid: 'lBdLINUWk',
        title: 'Prom dash',
        type: DashboardSearchItemType.DashDB,
      }),
    ],
  }),

  makeSection({
    title: 'Recent',
    icon: 'clock-o',
    score: -1,
    expanded: false,
    items: [
      makeSectionItem({
        id: 4072,
        uid: 'OzAIf_rWz',
        title: 'New dashboard Copy 3',

        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 46,
        uid: '8DY63kQZk',
        title: 'Stocks',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 20,
        uid: '7MeksYbmk',
        title: 'Alerting with TestData',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        folderId: 2,
      }),
      makeSectionItem({
        id: 4073,
        uid: 'j9SHflrWk',
        title: 'New dashboard Copy 4',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        folderId: 2,
      }),
    ],
  }),

  makeSection({
    id: 2,
    uid: 'JB_zdOUWk',
    title: 'gdev dashboards',
    expanded: true,
    url: '/dashboards/f/JB_zdOUWk/gdev-dashboards',
    icon: 'folder',
    score: 2,
    items: [],
  }),

  makeSection({
    id: 2568,
    uid: 'search-test-data',
    title: 'Search test data folder',
    expanded: false,
    items: [],
    url: '/dashboards/f/search-test-data/search-test-data-folder',
    icon: 'folder',
    score: 3,
  }),

  makeSection({
    id: 4074,
    uid: 'iN5TFj9Zk',
    title: 'Test',
    expanded: false,
    items: [],
    url: '/dashboards/f/iN5TFj9Zk/test',
    icon: 'folder',
    score: 4,
  }),

  makeSection({
    id: 0,
    title: 'General',
    icon: 'folder-open',
    score: 5,
    expanded: true,
    items: [
      makeSectionItem({
        id: 4069,
        uid: 'LCFWfl9Zz',
        title: 'New dashboard Copy',
        uri: 'db/new-dashboard-copy',
        url: '/d/LCFWfl9Zz/new-dashboard-copy',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 4072,
        uid: 'OzAIf_rWz',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 1,
        uid: 'lBdLINUWk',
        title: 'Prom dash',
        type: DashboardSearchItemType.DashDB,
        isStarred: true,
      }),
    ],
  }),
];

export const checkedGeneralFolder: DashboardSection[] = [
  makeSection({
    id: 4074,
    uid: 'other-folder-dash',
    title: 'Test',
    expanded: false,
    type: DashboardSearchItemType.DashFolder,
    items: [
      makeSectionItem({
        id: 4072,
        uid: 'other-folder-dash-abc',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 46,
        uid: 'other-folder-dash-def',
        title: 'Stocks',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
    ],
    url: '/dashboards/f/iN5TFj9Zk/test',
    icon: 'folder',
    score: 4,
  }),

  makeSection({
    id: 0,
    title: 'General',
    uid: 'other-folder-abc',
    score: 5,
    expanded: true,
    checked: true,
    type: DashboardSearchItemType.DashFolder,
    items: [
      makeSectionItem({
        id: 4069,
        uid: 'general-abc',
        title: 'New dashboard Copy',
        uri: 'db/new-dashboard-copy',
        url: '/d/LCFWfl9Zz/new-dashboard-copy',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
      makeSectionItem({
        id: 4072,
        uid: 'general-def',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
      makeSectionItem({
        id: 1,
        uid: 'general-ghi',
        title: 'Prom dash',
        type: DashboardSearchItemType.DashDB,
        isStarred: true,
        checked: true,
      }),
    ],
  }),
];

export const checkedOtherFolder: DashboardSection[] = [
  makeSection({
    id: 4074,
    uid: 'other-folder-abc',
    title: 'Test',
    expanded: false,
    checked: true,
    type: DashboardSearchItemType.DashFolder,
    items: [
      makeSectionItem({
        id: 4072,
        uid: 'other-folder-dash-abc',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
      makeSectionItem({
        id: 46,
        uid: 'other-folder-dash-def',
        title: 'Stocks',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
    ],
    url: '/dashboards/f/iN5TFj9Zk/test',
    icon: 'folder',
    score: 4,
  }),

  makeSection({
    id: 0,
    title: 'General',
    icon: 'folder-open',
    score: 5,
    expanded: true,
    type: DashboardSearchItemType.DashFolder,
    items: [
      makeSectionItem({
        id: 4069,
        uid: 'general-abc',
        title: 'New dashboard Copy',
        uri: 'db/new-dashboard-copy',
        url: '/d/LCFWfl9Zz/new-dashboard-copy',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 4072,
        uid: 'general-def',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
      }),
      makeSectionItem({
        id: 1,
        uid: 'general-ghi',
        title: 'Prom dash',
        type: DashboardSearchItemType.DashDB,
        isStarred: true,
      }),
    ],
  }),
];

export const folderViewAllChecked: DashboardSection[] = [
  makeSection({
    checked: true,
    selected: true,
    title: '',
    items: [
      makeSectionItem({
        id: 4072,
        uid: 'other-folder-dash-abc',
        title: 'New dashboard Copy 3',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
      makeSectionItem({
        id: 46,
        uid: 'other-folder-dash-def',
        title: 'Stocks',
        type: DashboardSearchItemType.DashDB,
        isStarred: false,
        checked: true,
      }),
    ],
  }),
];
