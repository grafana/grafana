import { useCallback } from 'react';

import { Field, LinkModel, TimeRange, DataFrame, SplitOpen, ExploreUrlState, urlUtil } from '@grafana/data';
import { getFieldLinksForExplore, VariableInterpolation } from '@grafana/runtime';
import { ExploreItemState } from 'app/types/explore';

import { getUrlStateFromPaneState } from '../hooks/useStateSync';

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
