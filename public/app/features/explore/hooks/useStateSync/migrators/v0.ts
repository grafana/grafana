import { ExploreUrlState } from '@grafana/data';
import { DEFAULT_RANGE } from 'app/features/explore/state/constants';

import { BaseExploreURL, MigrationHandler } from './types';

export interface ExploreURLV0 extends BaseExploreURL {
  schemaVersion: 0;
  left: ExploreUrlState;
  right?: ExploreUrlState;
}

export const v0Migrator: MigrationHandler<never, ExploreURLV0> = {
  parse: (params) => {
    // If no params are provided, return the default state without errors
    // This means the user accessed the explore page without any params
    if (!params.left && !params.right) {
      return {
        to: {
          left: {
            datasource: null,
            queries: [],
            range: {
              from: DEFAULT_RANGE.from,
              to: DEFAULT_RANGE.to,
            },
          },
          schemaVersion: 0,
        },
        error: false,
      };
    }

    let left: ExploreUrlState | undefined;
    let right: ExploreUrlState | undefined;
    let leftError, rightError: boolean | undefined;

    if (typeof params.left === 'string') {
      [left, leftError] = parsePaneState(params.left);
    }

    if (typeof params.right === 'string') {
      [right, rightError] = parsePaneState(params.right);
    } else if (params.right) {
      right = FALLBACK_PANE_VALUE;
      rightError = true;
    }

    if (!left) {
      left = FALLBACK_PANE_VALUE;
    }

    return {
      to: {
        schemaVersion: 0,
        left,
        ...(right && { right }),
      },
      error: !!leftError || !!rightError,
    };
  },
};

const isSegment = (segment: { [key: string]: string }, ...props: string[]) =>
  props.some((prop) => segment.hasOwnProperty(prop));

enum ParseUrlStateIndex {
  RangeFrom = 0,
  RangeTo = 1,
  Datasource = 2,
  SegmentsStart = 3,
}

const FALLBACK_PANE_VALUE: ExploreUrlState = {
  datasource: null,
  queries: [],
  range: DEFAULT_RANGE,
};

function parsePaneState(initial: string): [ExploreUrlState, boolean] {
  let parsed;
  try {
    parsed = JSON.parse(initial);
  } catch {
    return [FALLBACK_PANE_VALUE, true];
  }

  if (!Array.isArray(parsed)) {
    return [{ queries: [], range: DEFAULT_RANGE, ...parsed }, false];
  }

  if (parsed.length <= ParseUrlStateIndex.SegmentsStart) {
    return [FALLBACK_PANE_VALUE, true];
  }

  const range = {
    from: parsed[ParseUrlStateIndex.RangeFrom],
    to: parsed[ParseUrlStateIndex.RangeTo],
  };
  const datasource = parsed[ParseUrlStateIndex.Datasource];
  const parsedSegments = parsed.slice(ParseUrlStateIndex.SegmentsStart);
  const queries = parsedSegments.filter((segment) => !isSegment(segment, 'ui', 'mode', '__panelsState'));

  const panelsState = parsedSegments.find((segment) => isSegment(segment, '__panelsState'))?.__panelsState;
  return [{ datasource, queries, range, panelsState }, false];
}
