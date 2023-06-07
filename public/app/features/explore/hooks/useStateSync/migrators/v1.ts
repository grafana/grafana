import { ExploreUrlState } from '@grafana/data';
import { DEFAULT_RANGE, generateExploreId, safeParseJson } from 'app/core/utils/explore';

import { BaseExploreURL, MigrationHandler } from './types';
import { ExploreURLV0 } from './v0';

export interface ExploreURLV1 extends BaseExploreURL {
  schemaVersion: 1;
  panes: {
    [id: string]: ExploreUrlState;
  };
}

export const v1Migrator: MigrationHandler<ExploreURLV0, ExploreURLV1> = {
  parse: (params) => {
    if (!params || !params.panes || typeof params.panes !== 'string') {
      return {
        schemaVersion: 1,
        panes: {
          [generateExploreId()]: parseUrlState(undefined),
        },
      };
    }

    return {
      schemaVersion: 1,
      panes: Object.entries(safeParseJson(params?.panes) || { [generateExploreId()]: parseUrlState(undefined) }).reduce(
        (acc, [key, value]) => {
          return {
            ...acc,
            [key]: value,
          };
        },
        {}
      ),
    };
  },
  migrate: (params) => {
    return {
      schemaVersion: 1,
      panes: {
        [generateExploreId()]: params.left,
        ...(params.right && { [generateExploreId()]: params.right }),
      },
    };
  },
};

function parseUrlState(initial: string | undefined): ExploreUrlState {
  const parsed = safeParseJson(initial);
  const errorResult = {
    datasource: '',
    queries: [],
    range: DEFAULT_RANGE,
  };

  if (!parsed) {
    return errorResult;
  }

  return { queries: [], range: DEFAULT_RANGE, ...parsed };
}
