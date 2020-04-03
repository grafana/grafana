import { DashboardSection, DashboardSectionItem } from './types';
import { NO_ID_SECTIONS } from './constants';
import { parse, SearchParserResult } from 'search-query-parser';

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

export const getLookupField = (title: string) => {
  return hasId(title) ? 'id' : 'title';
};

export const markSelected = (sections: DashboardSection[], selectedId: string) => {
  return sections.map((result: DashboardSection) => {
    const lookupField = getLookupField(selectedId);
    result = { ...result, selected: String(result[lookupField]) === selectedId };

    if (result.expanded && result.items.length) {
      result.items = result.items.map(item => {
        const [sectionId, itemId] = selectedId.split('-');
        const lookup = getLookupField(sectionId);
        return { ...item, selected: String(item.id) === itemId && String(result[lookup]) === sectionId };
      });
    }
    return result;
  });
};

export const findSelected = (sections: any): DashboardSection | DashboardSectionItem | null => {
  let found = null;
  for (const section of sections) {
    if (section.expanded && section.items.length) {
      found = findSelected(section.items);
    }
    if (section.selected) {
      found = section;
    }
    if (found) {
      return found;
    }
  }

  return null;
};

export const parseQuery = (query: string) => {
  const parsedQuery = parse(query, {
    keywords: ['folder'],
  });

  if (typeof parsedQuery === 'string') {
    return {
      text: parsedQuery,
    } as SearchParserResult;
  }

  return parsedQuery;
};
