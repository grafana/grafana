import { values as _values } from 'lodash';
import moment from 'moment-timezone';

import { SelectableValue, unEscapeStringFromRegex } from '@grafana/data';
import { IconName } from '@grafana/ui';

import { DEFAULT_SORT, SESSION_DS_INS_URL_KEY, DEFAULT_CALC_FIELD } from './constants';
import { SearchQuery, CalcFieldModule, CalcFieldItem, SearchLayout, CalcFields, FormColumn } from './types';

const trimmedQueryLength = 67;
/**
 * Returns value as date if value is timestamp, otherwise return the value.
 */
export const convertTimeStampToDate = (value: any, format: string, timezone: string) => {
  if (value === 0 || !moment(value).isValid()) {
    return undefined;
  }
  const dateTime = timezone === 'browser' ? moment.unix(value) : moment.unix(value).tz(timezone);
  const formattedDateTime = dateTime.format(format);
  return formattedDateTime;
};

/**
 * Find items with property 'selected' set true in a list of folders and their items.
 * Does recursive search in the items list.
 * @param sections
 */
export const findSelected = (sections: any): CalcFieldModule | CalcFieldItem | null => {
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
/**
 * Collect ids of all checked fields. Used for delete operation
 * @param sections
 */
export const getCheckedIds = (
  results: CalcFieldModule[] | CalcFieldItem[],
  layout: SearchLayout.Module | SearchLayout.List
): CalcFieldItem[] => {
  const fields: CalcFieldItem[] = [];
  layout === SearchLayout.Module
    ? (results as CalcFieldModule[]).map((res: CalcFieldModule) => {
        res.items?.map((item: CalcFieldItem) => {
          if (item.checked) {
            fields.push(item);
          }
        });
      })
    : (results as CalcFieldItem[]).map((item: CalcFieldItem) => {
        if (item.checked) {
          fields.push(item);
        }
      });
  return fields;
};

export const getCheckedItem = (
  selection: CalcFieldModule[] | CalcFieldItem[],
  layout: SearchLayout.Module | SearchLayout.List
): CalcFieldItem | undefined => {
  let checkedItem: CalcFieldItem | undefined;
  if (layout === SearchLayout.Module) {
    (selection as CalcFieldModule[]).find((sel: CalcFieldModule) => {
      return sel.items?.find((item: CalcFieldItem) => {
        if (item.checked) {
          checkedItem = item;
        }
        return item.checked;
      });
    });
  } else {
    checkedItem = (selection as CalcFieldItem[]).find((item: CalcFieldItem) => item.checked);
  }
  return checkedItem;
};

/**
 * Check if search query has filters enabled. Excludes folderId
 * @param query
 */
export const hasFilters = (query: SearchQuery) => {
  if (!query) {
    return false;
  }
  return Boolean(query.query || query.sort || query.filterType);
};

/**
 * Get section icon depending on expanded state. Currently works for folder icons only
 * @param section
 */
export const getSectionIcon = (section: CalcFieldModule): IconName => {
  return section.expanded ? 'folder-open' : 'folder';
};

/**
 * Sort sections (dashboards) results object by given sort order
 * @param results
 * @param sortOrder
 */
export const sortSectionResults = (results: CalcFieldModule[], sortOrder: SelectableValue): CalcFieldModule[] => {
  switch (sortOrder ? sortOrder.value : DEFAULT_SORT.value) {
    case 'alpha-asc': {
      const sortedSections = results.sort((a: CalcFieldModule, b: CalcFieldModule) =>
        a.title?.toLowerCase() > b.title?.toLowerCase() ? 1 : -1
      );
      sortedSections.map((res) => res.items && sortListResults(res.items, sortOrder));
      return sortedSections;
    }
    case 'alpha-desc': {
      const sortedSections = results.sort((a: CalcFieldModule, b: CalcFieldModule) =>
        b.title?.toLowerCase() > a.title?.toLowerCase() ? 1 : -1
      );
      sortedSections.map((res) => res.items && sortListResults(res.items, sortOrder));
      return sortedSections;
    }
    default: {
      return results;
    }
  }
};

/**
 * Sort sections items (fields) results object by given sort order
 * @param results
 * @param sortOrder
 */
export const sortListResults = (results: CalcFieldItem[], sortOrder: SelectableValue): CalcFieldItem[] => {
  switch (sortOrder ? sortOrder.value : DEFAULT_SORT.value) {
    case 'alpha-asc': {
      const sortedReports = results.sort((a: CalcFieldItem, b: CalcFieldItem) =>
        a.name?.toLowerCase() > b.name?.toLowerCase() ? 1 : -1
      );
      return sortedReports;
    }
    case 'alpha-desc': {
      const sortedReports = results.sort((a: CalcFieldItem, b: CalcFieldItem) =>
        b.name?.toLowerCase() > a.name?.toLowerCase() ? 1 : -1
      );
      return sortedReports;
    }
    default: {
      return results;
    }
  }
};

export const handleCalcFieldResponse = (results: CalcFieldItem[], layout: SearchLayout.List | SearchLayout.Module) => {
  const modifiedResults = results?.map((item: CalcFieldItem) => {
    return { ...item, fieldId: `${item.field_type}_${item.fieldId}` };
  });
  return layout === SearchLayout.List ? modifiedResults : makeModuleWiseList(modifiedResults);
};

export const makeModuleWiseList = (results: CalcFieldItem[]): CalcFieldModule[] => {
  let ModuleIdCounter = 1;
  const moduleMap: { [key: string]: CalcFieldModule } = {};
  results.forEach((item: CalcFieldItem) => {
    if (moduleMap.hasOwnProperty(item.module)) {
      moduleMap[item.module].items.push(item);
    } else {
      moduleMap[item.module] = {
        id: ModuleIdCounter++,
        items: [item],
        title: item.module,
        icon: 'folder',
      };
    }
  });
  return _values(moduleMap);
};

export const filterByType = (items: CalcFieldItem[], type: string): CalcFieldItem[] => {
  if (type && type !== 'All') {
    return items.filter((item: CalcFieldItem) => item.field_type === type);
  }
  return items;
};

export const filterByQuery = (
  results: CalcFieldModule[] | CalcFieldItem[],
  query: string,
  layout: SearchLayout.Module | SearchLayout.List
): CalcFieldModule[] | CalcFieldItem[] => {
  if (!query) {
    return results;
  }
  if (layout === SearchLayout.Module) {
    const filteredResult: CalcFieldModule[] = [];
    (results as CalcFieldModule[]).map((result: CalcFieldModule) => {
      const filteredItems: CalcFieldItem[] = result.items?.filter((item: CalcFieldItem) =>
        item.name.toLowerCase().includes(unEscapeStringFromRegex(query).toLowerCase())
      );
      if (filteredItems.length) {
        filteredResult.push({ ...result, items: filteredItems, expanded: true });
      }
    });
    return filteredResult;
  } else {
    return (results as CalcFieldItem[]).filter((item: CalcFieldItem) =>
      item.name?.toLowerCase().includes(unEscapeStringFromRegex(query).toLowerCase())
    );
  }
};

export const setDsInstanceUrl = (url: string): void => {
  sessionStorage.setItem(SESSION_DS_INS_URL_KEY, url);
};

export const getDsInstanceUrl = (): string | null => {
  return sessionStorage.getItem(SESSION_DS_INS_URL_KEY);
};

export const clearDsInstanceUrl = (): void => {
  sessionStorage.removeItem(SESSION_DS_INS_URL_KEY);
};

export const getFieldNModule = (fields: CalcFieldItem[], uid: string | undefined): [CalcFields, string[]] => {
  const moduleSet = new Set<string>();
  let selectedField: CalcFields = DEFAULT_CALC_FIELD;
  fields.map((item: CalcFieldItem) => {
    moduleSet.add(item.module);
    if (uid && `${item.field_type}_${item.fieldId}` === uid) {
      selectedField = item as CalcFields;
    }
  });
  return [selectedField, [...moduleSet]];
};

export const getColumnsArr = (results: FormColumn[]): string[] => {
  const cols = new Set<string>();
  results.map?.((item: FormColumn) => {
    item.field_option !== 'DISPLAY' && cols.add(item.name);
  });
  return [...cols];
};

export const buildValidateQuery = (fields: CalcFields): string => {
  return `SELECT ${fields.sqlQuery} from \`${fields.formName}\` LIMIT 1`.replace(/\"/g, '`');
};

export const isSaveEnabled = (fields: CalcFields): boolean => {
  return !!(fields.name && fields.module && fields.formName && fields.rawQueryValidated);
};

export const getTrimQuery = (query: string): string => {
  return query.length < trimmedQueryLength ? query : query.substr(0, trimmedQueryLength) + '...';
};
