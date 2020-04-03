import { DashboardSection } from './types';
import { NO_ID_SECTIONS } from './constants';

export const hasId = (str: string) => {
  return !NO_ID_SECTIONS.includes(str);
};

/**
 * Return ids for sections concatenated with their items ids, if section is expanded
 * @param sections
 */
export const getFlattenedSections = (sections: DashboardSection[]): string[] => {
  return sections.flatMap(section => {
    const id = hasId(section.title) ? section.id : section.title;

    if (section.expanded && section.items.length) {
      return [String(id), ...section.items.map(item => `${id}-${item.id}`)];
    }
    return String(id);
  });
};

export const markSelected = (sections: DashboardSection[], selectedId: string) => {
  return sections.map((result: DashboardSection) => {
    const lookupField = hasId(selectedId) ? 'id' : 'title';
    result = { ...result, selected: String(result[lookupField]) === selectedId };

    if (result.expanded && result.items.length) {
      result.items = result.items.map(item => {
        const [sectionId, itemId] = selectedId.split('-');
        const lookup = hasId(sectionId) ? 'id' : 'title';
        return { ...item, selected: String(item.id) === itemId && String(result[lookup]) === sectionId };
      });
    }
    return result;
  });
};
