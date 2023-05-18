import { nanoid } from '@reduxjs/toolkit';

import { ExploreUrlState } from '@grafana/data';
import { parseUrlState, safeParseJson } from 'app/core/utils/explore';

export const parseURL = (params: AnyExploreParams) => {
  return migrate(params);
};

interface AnyExploreParams {
  [key: string]: string;
}

// don't look at this yet, it's a placeholder for the actual migrations
const migrate = (params?: AnyExploreParams): ExploreURL => {
  // v0 - compact URLs
  if (params && !('schemaVersion' in params)) {
    // schemaVersion is not in the URL, so it must be v0
    return {
      schemaVersion: 1,
      panes: {
        [nanoid()]: parseUrlState(params.left),
        ...(params.right && { [nanoid()]: parseUrlState(params.right) }),
      },
    };
  }

  return {
    schemaVersion: 1,
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
  // TODO: this should be the first migration
  // @ts-ignore
};

interface BaseExploreURL {
  schemaVersion: number;
}

// interface ExploreURLV0 extends BaseExploreURL {
//   schemaVersion: never;
//   left: {};
//   right?: {};
// }

interface ExploreURLV1 extends BaseExploreURL {
  schemaVersion: 1;
  panes: {
    [id: string]: ExploreUrlState;
  };
}

// type AnyExploreURL = ExploreURLV0 | ExploreURLV1;

type ExploreURL = ExploreURLV1;

// type MigrationHandler<In extends AnyExploreURL, Out extends AnyExploreURL> = (
//   urlState: In
// ) => Omit<Out, 'schemaVersion'> & { schemaVersion?: never };

// const v1Migrator: MigrationHandler<ExploreURLV0, ExploreURLV1> = (urlState) => {
//   return {
//     panes: {
//       left: urlState.left,
//       ...(urlState.right && { right: urlState.right }),
//     },
//   };
// };
