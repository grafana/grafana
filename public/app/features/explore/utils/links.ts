import { first, uniqBy } from 'lodash';
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
  DataLinkConfigOrigin,
  CoreApp,
  SplitOpenOptions,
  DataLinkPostProcessor,
  ExploreUrlState,
  urlUtil,
} from '@grafana/data';
import { getTemplateSrv, reportInteraction, VariableInterpolation } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { getTransformationVars } from 'app/features/correlations/transformations';
import { ExploreItemState } from 'app/types/explore';

import { getLinkSrv } from '../../panel/panellinks/link_srv';
import { getUrlStateFromPaneState } from '../hooks/useStateSync';

type DataLinkFilter = (link: DataLink, scopedVars: ScopedVars) => boolean;

const dataLinkHasRequiredPermissionsFilter = (link: DataLink) => {
  return !link.internal || contextSrv.hasAccessToExplore();
};

/**
 * Fixed list of filters used in Explore. DataLinks that do not pass all the filters will not
 * be passed back to the visualization.
 */
const DATA_LINK_FILTERS: DataLinkFilter[] = [dataLinkHasRequiredPermissionsFilter];

/**
 * This extension of the LinkModel was done to support correlations, which need the variables' names
 * and values split out for display purposes
 *
 * Correlations are internal links only so the variables property will always be defined (but possibly empty)
 * for internal links and undefined for non-internal links
 */
export interface ExploreFieldLinkModel extends LinkModel<Field> {
  variables: VariableInterpolation[];
}

const DATA_LINK_USAGE_KEY = 'grafana_data_link_clicked';

/**
 * Creates an internal link supplier specific to Explore
 */
export const exploreDataLinkPostProcessorFactory = (
  splitOpenFn: SplitOpen | undefined,
  range: TimeRange
): DataLinkPostProcessor => {
  const exploreDataLinkPostProcessor: DataLinkPostProcessor = (options) => {
    const { field, dataLinkScopedVars: vars, frame: dataFrame, link, linkModel } = options;
    const { valueRowIndex: rowIndex } = options.config;

    if (rowIndex === undefined) {
      return linkModel;
    }

    /**
     * Even though getFieldLinksForExplore can produce internal and external links we re-use the logic for creating
     * internal links only. Eventually code from getFieldLinksForExplore can be moved here and getFieldLinksForExplore
     * can be removed (once all Explore panels start using field.getLinks).
     */
    const links = getFieldLinksForExplore({
      field,
      rowIndex,
      splitOpenFn,
      range,
      vars,
      dataFrame,
      linksToProcess: [link],
    });

    return links.length ? first(links) : undefined;
  };
  return exploreDataLinkPostProcessor;
};

/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 *
 * Note: accessing a field via ${__data.fields.variable} will stay consistent with dashboards and return as existing but with an empty string
 * Accessing a field with ${variable} will return undefined as this is unique to explore.
 * @deprecated Use field.getLinks directly
 */
export const getFieldLinksForExplore = (options: {
  field: Field;
  rowIndex: number;
  splitOpenFn?: SplitOpen;
  range: TimeRange;
  vars?: ScopedVars;
  dataFrame?: DataFrame;
  // if not provided, field.config.links are used
  linksToProcess?: DataLink[];
}): ExploreFieldLinkModel[] => {
  const { field, vars, splitOpenFn, range, rowIndex, dataFrame } = options;
  const scopedVars: ScopedVars = { ...(vars || {}) };
  scopedVars['__value'] = {
    value: {
      raw: field.values[rowIndex],
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

  const linksToProcess = options.linksToProcess || field.config.links;

  if (linksToProcess) {
    const links = linksToProcess.filter((link) => {
      return DATA_LINK_FILTERS.every((filter) => filter(link, scopedVars));
    });

    const fieldLinks = links.map((link) => {
      let internalLinkSpecificVars: ScopedVars = {};
      if (link.meta?.transformations) {
        link.meta?.transformations.forEach((transformation) => {
          let fieldValue;
          if (transformation.field) {
            const transformField = dataFrame?.fields.find((field) => field.name === transformation.field);
            fieldValue = transformField?.values[rowIndex];
          } else {
            fieldValue = field.values[rowIndex];
          }

          internalLinkSpecificVars = {
            ...internalLinkSpecificVars,
            ...getTransformationVars(transformation, fieldValue, field.name),
          };
        });
      }

      const allVars = { ...scopedVars, ...internalLinkSpecificVars };
      const variableData = getVariableUsageInfo(link, allVars);
      let variables: VariableInterpolation[] = [];

      // if the link has no variables (static link), add it with the right key but an empty value so we know what field the static link is associated with
      if (variableData.variables.length === 0) {
        const fieldName = field.name.toString();
        variables.push({ variableName: fieldName, value: '', match: '' });
      } else {
        variables = variableData.variables;
      }
      if (variableData.allVariablesDefined) {
        if (!link.internal) {
          const replace: InterpolateFunction = (value, vars) =>
            getTemplateSrv().replace(value, { ...vars, ...allVars, ...scopedVars });

          const linkModel = getLinkSrv().getDataLinkUIModel(link, replace, field);
          if (!linkModel.title) {
            linkModel.title = getTitleFromHref(linkModel.href);
          }
          linkModel.target = '_blank';
          return { ...linkModel, variables: variables };
        } else {
          const splitFnWithTracking = (options?: SplitOpenOptions<DataQuery>) => {
            reportInteraction(DATA_LINK_USAGE_KEY, {
              origin: link.origin || DataLinkConfigOrigin.Datasource,
              app: CoreApp.Explore,
              internal: true,
            });

            splitOpenFn?.(options);
          };

          const internalLink = mapInternalLinkToExplore({
            link,
            internalLink: link.internal,
            scopedVars: allVars,
            range,
            field,
            // Don't track internal links without split view as they are used only in Dashboards
            onClickFn: options.splitOpenFn ? (options) => splitFnWithTracking(options) : undefined,
            replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
          });
          return { ...internalLink, variables: variables };
        }
      } else {
        return undefined;
      }
    });
    return fieldLinks.filter((link): link is ExploreFieldLinkModel => !!link);
  }
  return [];
};

/**
 * @internal
 */
export function getTitleFromHref(href: string): string {
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

// See https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
const builtInVariables = [
  '__from',
  '__to',
  '__interval',
  '__interval_ms',
  '__org',
  '__user',
  '__range',
  '__rate_interval',
  '__timeFilter',
  'timeFilter',
  // These are only applicable in dashboards so should not affect this for Explore
  // '__dashboard',
  //'__name',
];

/**
 * Use variable map from templateSrv to determine if all variables have values
 * @param query
 * @param scopedVars
 */
export function getVariableUsageInfo(
  query: object,
  scopedVars: ScopedVars
): { variables: VariableInterpolation[]; allVariablesDefined: boolean } {
  let variables: VariableInterpolation[] = [];
  const replaceFn = getTemplateSrv().replace.bind(getTemplateSrv());
  // This adds info to the variables array while interpolating
  replaceFn(getStringsFromObject(query), scopedVars, undefined, variables);
  variables = uniqBy(variables, 'variableName');
  return {
    variables: variables,
    allVariablesDefined: variables
      // We filter out builtin variables as they should be always defined but sometimes only later, like
      // __range_interval which is defined in prometheus at query time.
      .filter((v) => !builtInVariables.includes(v.variableName))
      .every((variable) => variable.found),
  };
}

// Recursively get all strings from an object into a simple list with space as separator.
function getStringsFromObject(obj: Object): string {
  let acc = '';
  let k: keyof typeof obj;

  for (k in obj) {
    if (typeof obj[k] === 'string') {
      acc += ' ' + obj[k];
    } else if (typeof obj[k] === 'object') {
      acc += ' ' + getStringsFromObject(obj[k]);
    }
  }
  return acc;
}

type StateEntry = [string, ExploreItemState];
const isStateEntry = (entry: [string, ExploreItemState | undefined]): entry is StateEntry => {
  return entry[1] !== undefined;
};

export const constructAbsoluteUrl = (panes: Record<string, ExploreItemState | undefined>) => {
  const urlStates = Object.entries(panes)
    .filter(isStateEntry)
    .map(([exploreId, pane]) => {
      const urlState = getUrlStateFromPaneState(pane);
      urlState.range = {
        to: pane.range.to.valueOf().toString(),
        from: pane.range.from.valueOf().toString(),
      };
      const panes: [string, ExploreUrlState] = [exploreId, urlState];
      return panes;
    })
    .reduce((acc, [exploreId, urlState]) => {
      return { ...acc, [exploreId]: urlState };
    }, {});
  return urlUtil.renderUrl('/explore', { schemaVersion: 1, panes: JSON.stringify(urlStates) });
};
