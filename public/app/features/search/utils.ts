import { parse, SearchParserResult } from 'search-query-parser';
import { IconName } from '@grafana/ui';
import { DashboardQuery, DashboardSection, DashboardSectionItem, SearchAction, UidsToDelete } from './types';
import { NO_ID_SECTIONS, SECTION_STORAGE_KEY } from './constants';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';

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
    const id = hasId(section.title) ? String(section.id) : section.title;

    if (section.expanded && section.items.length) {
      return [id, ...section.items.map(item => `${id}-${item.id}`)];
    }
    return id;
  });
};

/**
 * Get all items for currently expanded sections
 * @param sections
 */
export const getVisibleItems = (sections: DashboardSection[]) => {
  return sections.flatMap(section => {
    if (section.expanded) {
      return section.items;
    }
    return [];
  });
};
/**
 * Since Recent and Starred folders don't have id, title field is used as id
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
      return {
        ...result,
        items: result.items.map(item => {
          const [sectionId, itemId] = selectedId.split('-');
          const lookup = getLookupField(sectionId);
          return { ...item, selected: String(item.id) === itemId && String(result[lookup]) === sectionId };
        }),
      };
    }
    return result;
  });
};

/**
 * Find items with property 'selected' set true in a list of folders and their items.
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

/**
 * Merge multiple reducers into one, keeping the state structure flat (no nested
 * separate state for each reducer). If there are multiple state slices with the same
 * key, the latest reducer's state is applied.
 * Compared to Redux's combineReducers this allows multiple reducers to operate
 * on the same state or different slices of the same state. Useful when multiple
 * components have the same structure but different or extra logic when modifying it.
 * If reducers have the same action types, the action types from the rightmost reducer
 * take precedence
 * @param reducers
 */
export const mergeReducers = (reducers: any[]) => (prevState: any, action: SearchAction) => {
  return reducers.reduce((nextState, reducer) => ({ ...nextState, ...reducer(nextState, action) }), prevState);
};

/**
 * Collect all the checked dashboards
 * @param sections
 */
export const getCheckedDashboards = (sections: DashboardSection[]): DashboardSectionItem[] => {
  if (!sections.length) {
    return [];
  }

  return sections.reduce((uids, section) => {
    return section.items ? [...uids, ...section.items.filter(item => item.checked)] : uids;
  }, []);
};

/**
 * Collect uids of all the checked dashboards
 * @param sections
 */
export const getCheckedDashboardsUids = (sections: DashboardSection[]) => {
  if (!sections.length) {
    return [];
  }

  return getCheckedDashboards(sections).map(item => item.uid);
};

/**
 * Collect uids of all checked folders and dashboards. Used for delete operation, among others
 * @param sections
 */
export const getCheckedUids = (sections: DashboardSection[]): UidsToDelete => {
  const emptyResults: UidsToDelete = { folders: [], dashboards: [] };

  if (!sections.length) {
    return emptyResults;
  }

  return sections.reduce((result, section) => {
    if (section?.id !== 0 && section.checked) {
      return { ...result, folders: [...result.folders, section.uid] };
    } else {
      return { ...result, dashboards: getCheckedDashboardsUids(sections) };
    }
  }, emptyResults) as UidsToDelete;
};

/**
 * When search is done within a dashboard folder, add folder id to the search query
 * to narrow down the results to the folder
 * @param query
 * @param queryParsing
 */
export const getParsedQuery = (query: DashboardQuery, queryParsing = false) => {
  const parsedQuery = { ...query, sort: query.sort?.value };
  if (!queryParsing) {
    return parsedQuery;
  }

  let folderIds: number[] = [];

  if (parseQuery(query.query).folder === 'current') {
    const { folderId } = getDashboardSrv().getCurrent().meta;
    if (folderId) {
      folderIds = [folderId];
    }
  }
  return { ...parsedQuery, query: parseQuery(query.query).text as string, folderIds };
};

/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export const hasFilters = (query: DashboardQuery) => {
  if (!query) {
    return false;
  }
  return Boolean(query.query || query.tag?.length > 0 || query.starred || query.sort);
};

/**
 * Get section icon depending on expanded state. Currently works for folder icons only
 * @param section
 */
export const getSectionIcon = (section: DashboardSection): IconName => {
  if (!hasId(section.title)) {
    return section.icon as IconName;
  }

  return section.expanded ? 'folder-open' : 'folder';
};

/**
 * Get storage key for a dashboard folder by its title
 * @param title
 */
export const getSectionStorageKey = (title: string) => {
  if (!title) {
    return '';
  }
  return `${SECTION_STORAGE_KEY}.${title.toLowerCase()}`;
};
