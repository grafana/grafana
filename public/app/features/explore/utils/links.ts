import { useCallback } from 'react';

import {
  Field,
  LinkModel,
  TimeRange,
  mapInternalLinkToExplore,
  InterpolateFunction,
  ScopedVars,
  DataFrame,
  getFieldDisplayValuesProxy,
  SplitOpen,
  DataLink,
  DisplayValue,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getTransformationVars } from 'app/features/correlations/transformations';

import { getLinkSrv } from '../../panel/panellinks/link_srv';

type DataLinkFilter = (link: DataLink, scopedVars: ScopedVars) => boolean;

const dataLinkHasRequiredPermissions = (link: DataLink) => {
  return !link.internal || contextSrv.hasAccessToExplore();
};

/**
 * Check if every variable in the link has a value. If not this returns false. If there are no variables in the link
 * this will return true.
 * @param link
 * @param scopedVars
 */
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

/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 */
export const getFieldLinksForExplore = (options: {
  field: Field;
  rowIndex: number;
  splitOpenFn?: SplitOpen;
  range: TimeRange;
  vars?: ScopedVars;
  dataFrame?: DataFrame;
}): Array<LinkModel<Field>> => {
  const { field, vars, splitOpenFn, range, rowIndex, dataFrame } = options;
  const scopedVars: ScopedVars = { ...(vars || {}) };
  scopedVars['__value'] = {
    value: {
      raw: field.values.get(rowIndex),
    },
    text: 'Raw value',
  };

  let fieldDisplayValuesProxy: Record<string, DisplayValue> | undefined = undefined;

  // If we have a dataFrame we can allow referencing other columns and their values in the interpolation.
  if (dataFrame) {
    fieldDisplayValuesProxy = getFieldDisplayValuesProxy({
      frame: dataFrame,
      rowIndex,
    });

    scopedVars['__data'] = {
      value: {
        name: dataFrame.name,
        refId: dataFrame.refId,
        fields: fieldDisplayValuesProxy,
      },
      text: 'Data',
    };

    dataFrame.fields.forEach((f) => {
      if (fieldDisplayValuesProxy && fieldDisplayValuesProxy[f.name]) {
        scopedVars[f.name] = {
          value: fieldDisplayValuesProxy[f.name],
        };
      }
    });

    // add this for convenience
    scopedVars['__targetField'] = {
      value: fieldDisplayValuesProxy[field.name],
    };
  }

  if (field.config.links) {
    const links = field.config.links.filter((link) => {
      return DATA_LINK_FILTERS.every((filter) => filter(link, scopedVars));
    });

    return links.map((link) => {
      if (!link.internal) {
        const replace: InterpolateFunction = (value, vars) =>
          getTemplateSrv().replace(value, { ...vars, ...scopedVars });

        const linkModel = getLinkSrv().getDataLinkUIModel(link, replace, field);
        if (!linkModel.title) {
          linkModel.title = getTitleFromHref(linkModel.href);
        }
        return linkModel;
      } else {
        let internalLinkSpecificVars: ScopedVars = {};
        if (link.internal?.transformations) {
          link.internal?.transformations.forEach((transformation) => {
            let fieldValue;
            if (transformation.field) {
              const transformField = dataFrame?.fields.find((field) => field.name === transformation.field);
              fieldValue = transformField?.values.get(rowIndex);
            } else {
              fieldValue = field.values.get(rowIndex);
            }

            internalLinkSpecificVars = {
              ...internalLinkSpecificVars,
              ...getTransformationVars(transformation, fieldValue, field.name),
            };
          });
        }

        return mapInternalLinkToExplore({
          link,
          internalLink: link.internal,
          scopedVars: { ...scopedVars, ...internalLinkSpecificVars },
          range,
          field,
          onClickFn: splitOpenFn,
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });
      }
    });
  }

  return [];
};

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
}

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
