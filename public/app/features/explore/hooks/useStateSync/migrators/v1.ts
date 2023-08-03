import { ExploreUrlState } from '@grafana/data';
import { generateExploreId, safeParseJson } from 'app/core/utils/explore';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';

import { hasKey } from '../../utils';

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
          [generateExploreId()]: DEFAULT_STATE,
        },
      };
    }

    const rawPanes: Record<string, unknown> = safeParseJson(params.panes) || {};

    const panes = Object.entries(rawPanes)
      .map(([key, value]) => [key, applyDefaults(value)] as const)
      .reduce<Record<string, ExploreUrlState>>((acc, [key, value]) => {
        return {
          ...acc,
          [key]: value,
        };
      }, {});

    if (!Object.keys(panes).length) {
      panes[generateExploreId()] = DEFAULT_STATE;
    }

    return {
      schemaVersion: 1,
      panes,
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

const DEFAULT_STATE: ExploreUrlState = {
  datasource: null,
  queries: [],
  range: DEFAULT_RANGE,
};

function applyDefaults(input: unknown): ExploreUrlState {
  if (!input || typeof input !== 'object') {
    return DEFAULT_STATE;
  }

  return {
    ...DEFAULT_STATE,
    // queries
    ...(hasKey('queries', input) && Array.isArray(input.queries) && { queries: input.queries }),
    // datasource
    ...(hasKey('datasource', input) && typeof input.datasource === 'string' && { datasource: input.datasource }),
    // panelsState
    ...(hasKey('panelsState', input) &&
      !!input.panelsState &&
      typeof input.panelsState === 'object' && { panelsState: input.panelsState }),
    // range
    ...(hasKey('range', input) &&
      !!input.range &&
      typeof input.range === 'object' &&
      hasKey('from', input.range) &&
      hasKey('to', input.range) &&
      typeof input.range.from === 'string' &&
      typeof input.range.to === 'string' && { range: { from: input.range.from, to: input.range.to } }),
  };
}
