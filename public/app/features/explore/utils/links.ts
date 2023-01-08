import { useCallback } from 'react';

import {
  Field,
  LinkModel,
  TimeRange,
  InterpolateFunction,
  ScopedVars,
  DataFrame,
  SplitOpen,
  DataLink,
  getLinksSupplier,
} from '@grafana/data';
import { DataLinkFilter } from '@grafana/data/src/field/fieldOverrides';
import { getTemplateSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

const dataLinkHasRequiredPermissions = (link: DataLink) => {
  return !link.internal || contextSrv.hasAccessToExplore();
};

const dataLinkHasAllVariablesDefined = (link: DataLink, scopedVars: ScopedVars) => {
  let hasAllRequiredVarDefined = true;

  if (link.internal) {
    let stringifiedQuery = '';
    try {
      stringifiedQuery = JSON.stringify(link.internal.query || {});
      // Hook into format function to verify if all values are non-empty
      // Format function is run on all existing field values allowing us to check it's value is non-empty
      getTemplateSrv().replace(stringifiedQuery, scopedVars, (f: string) => {
        hasAllRequiredVarDefined = hasAllRequiredVarDefined && !!f;
        return '';
      });
    } catch (err) {}
  }

  return hasAllRequiredVarDefined;
};

/**
 * Fixed list of filters used in Explore. DataLinks that do not pass all the filters will not
 * be passed back to the visualization.
 */
const DATA_LINK_FILTERS: DataLinkFilter[] = [dataLinkHasAllVariablesDefined, dataLinkHasRequiredPermissions];
const replaceFunction: InterpolateFunction = (value, vars) => getTemplateSrv().replace(value, vars);

export const getFieldLinksForExplore = (options: {
  field: Field;
  rowIndex: number;
  splitOpenFn?: SplitOpen;
  range: TimeRange;
  vars?: ScopedVars;
  dataFrame?: DataFrame;
}): Array<LinkModel<Field>> => {
  const { field, vars, splitOpenFn, range, rowIndex, dataFrame } = options;
  return getLinksSupplier({
    frame: dataFrame,
    field,
    fieldScopedVars: vars,
    replaceVariables: replaceFunction,
    range,
    dataLinkFilters: DATA_LINK_FILTERS,
    exploreSplitOpenFn: splitOpenFn,
  })({ valueRowIndex: rowIndex });
};

/*
TODO : do we make this logic part of getLinksSupplier? Or optionally pass it in? Or forget it? 

function getTitleFromHref(href: string): string {
  // The URL constructor needs the url to have protocol
  if (href.indexOf('://') < 0) {
    // Doesn't really matter what protocol we use.
    href = `http://${href}`;
  }
  let title;
  try {
    const parsedUrl = new URL(href);
    title = parsedUrl.hostname;
  } catch (_e) {
    // Should be good enough fallback, user probably did not input valid url.
    title = href;
  }
  return title;
}*/

/**
 * Hook that returns a function that can be used to retrieve all the links for a row. This returns all the links from
 * all the fields so is useful for visualisation where the whole row is represented as single clickable item like a
 * service map.
 */
export function useLinks(range: TimeRange, splitOpenFn?: SplitOpen) {
  return useCallback(
    (dataFrame: DataFrame, rowIndex: number) => {
      return dataFrame.fields.flatMap((f) => {
        if (f.config?.links && f.config?.links.length) {
          return getFieldLinksForExplore({
            field: f,
            rowIndex: rowIndex,
            range,
            dataFrame,
            splitOpenFn,
          });
        } else {
          return [];
        }
      });
    },
    [range, splitOpenFn]
  );
}
