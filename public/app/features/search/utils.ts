import { DashboardSection } from './types';

/**
 * Return ids for sections concatenated with their items ids, if section is expanded
 * @param sections
 */
export const getFlattenedSections = (sections: DashboardSection[]): string[] => {
  return sections.flatMap(section => {
    const id = section.id === undefined ? section.title : section.id;
    if (section.expanded && section.items.length) {
      return [String(id), ...section.items.map(item => `${id}-${item.id}`)];
    }
    return String(id);
  });
};

export const markSelected = (sections: DashboardSection[], selectedId: string) => {
  return sections.map((result: DashboardSection) => {
    const lookupField = ['Starred', 'Recent'].includes(selectedId as any) ? 'title' : 'id';
    result.selected = String(result[lookupField]) === selectedId;
    if (result.expanded && result.items.length) {
      result.items = result.items.map(item => {
        item.selected = String(item[lookupField]) === selectedId.split('-')[1];
        return item;
      });
    }
    return result;
  });
};
