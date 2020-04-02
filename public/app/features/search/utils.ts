import { DashboardSection } from './types';

/**
 * Return ids for sections concatenated with their items ids, if section is expanded
 * @param sections
 */
export const getFlattenedSections = (sections: DashboardSection[]) => {
  return sections.flatMap(section => {
    const id = section.id === undefined ? section.title : section.id;
    if (section.expanded && section.items.length) {
      return [id, ...section.items.map(item => item.id)];
    }
    return id;
  });
};
