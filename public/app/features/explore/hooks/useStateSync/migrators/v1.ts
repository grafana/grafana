import { nanoid } from '@reduxjs/toolkit';

import { ExploreUrlState } from '@grafana/data';
import { DEFAULT_RANGE, safeParseJson } from 'app/core/utils/explore';

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
    return {
      panes: Object.entries(safeParseJson(params?.panes) || { [nanoid()]: parseUrlState(undefined) }).reduce(
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
        [nanoid()]: params.left,
        ...(params.right && { [nanoid()]: params.right }),
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
