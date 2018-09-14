import { DashboardSection, DashboardSectionItem } from '../../../types';

export const getMockSections = (amount: number): DashboardSection[] => {
  const sections: DashboardSection[] = [];

  for (let i = 1; i <= amount; i++) {
    sections.push({
      id: i,
      uid: `asdf${i}`,
      title: 'Such a cool folder',
      expanded: false,
      items: [] as DashboardSectionItem[],
      url: `some/url/${i}`,
      icon: 'cool-icon',
      score: i,
    });
  }

  return sections;
};

export const getMockSection = (): DashboardSection => {
  return {
    id: 1,
    uid: 'asdf1',
    title: 'Such a cool folder',
    expanded: false,
    items: [] as DashboardSectionItem[],
    url: 'some/url/1',
    icon: 'cool-icon',
    score: 1,
  };
};

export const getMockSectionItems = (amount: number): DashboardSectionItem[] => {
  const items: DashboardSectionItem[] = [];

  for (let i = 0; i <= amount; i++) {
    items.push({
      id: i,
      uid: `id-${i}`,
      title: `item-${i}`,
      uri: '',
      url: `some/url/${i}`,
      type: '',
      tags: ['blue', 'green'],
      isStarred: false,
      folderId: 1,
      folderUid: 'folder-1',
      folderTitle: 'folderur',
      folderUrl: 'some/folderUrl/1',
    });
  }

  return items;
};
