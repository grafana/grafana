import { DashboardSection, DashboardSectionItem } from './types';
import { NO_ID_SECTIONS } from './constants';
import { parse, SearchParserResult } from 'search-query-parser';

/**
 * Check if folder has id. Only Recent and Starred folders are the ones without
 * ids so far, as they are created manually after results are fetched from API.
 * @param str
 */
export const hasId = (str: string) => {
  return !NO_ID_SECTIONS.includes(str);
};

/**
 * Return ids for folders concatenated with their items ids, if section is expanded.
 * For items the id format is '{folderId}-{itemId}' to allow mapping them to their folders
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

/**
 * Since Recent and Starred folders don't have id, title field is used for lookup for them
 * @param title - title field of the section
 */
export const getLookupField = (title: string) => {
  return hasId(title) ? 'id' : 'title';
};

/**
 * Go through all the folders and items in expanded folders and toggle their selected
 * prop according to currently selected index. Used for item highlighting when navigating
 * the search results list using keyboard arrows
 * @param sections
 * @param selectedId
 */
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

/**
 * Find items with property selected set true in a list of folders and their items.
 * Does recursive search in the items list.
 * @param sections
 */
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

// TODO find out if there are any use cases where query isn't a string
export const parseQuery = (query: any) => {
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
