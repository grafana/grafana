import { type DataQuery } from '@grafana/data';
import { SceneQueryRunner } from '@grafana/scenes';

import { setQueryRunnerQueries } from './setQueryRunnerQueries';

function query(refId: string, datasourceUid?: string): DataQuery {
  return { refId, datasource: datasourceUid ? { uid: datasourceUid } : undefined };
}

function queryWithType(refId: string, type: string): DataQuery {
  return { refId, datasource: { type } };
}

describe('setQueryRunnerQueries', () => {
  it('keeps a single, shared datasource when every query agrees', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [query('A', 'default-uid'), query('B', 'default-uid')]);

    expect(runner.state.datasource).toEqual({ uid: 'default-uid' });
  });

  it('flips to Mixed once queries point at different datasources', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [query('A', 'default-uid'), query('B', 'other-uid')]);

    expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
  });

  // A query with no datasource at all genuinely disagrees with one that has a real uid — this
  // function has no way to tell "not chosen yet" apart from "a deliberately different datasource",
  // so it correctly goes Mixed here too. PanelQueryEditor's "Add query" button avoids ever handing
  // this function that shape in the first place, by hinting the new query at an existing one's
  // datasource before calling this (see PanelQueryEditor.test.tsx's own coverage for that).
  it('treats a query with no datasource as disagreeing with one that has a real uid', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [query('A', 'default-uid'), query('B', undefined)]);

    expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
  });

  // The "-- Dashboard --" pseudo-datasource only ever handles one target per request — a non-Mixed
  // runner sending it two queries would silently drop all but one. getPanelDataSource
  // (layoutSerializers/utils.ts) already carves out this same special case when building a panel's
  // initial datasource from its persisted spec; this mirrors it for live edits.
  it('forces Mixed when two or more queries share the Dashboard pseudo-datasource', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [query('A', '-- Dashboard --'), query('B', '-- Dashboard --')]);

    expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
  });

  it('leaves a single Dashboard-datasource query alone', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [query('A', '-- Dashboard --')]);

    expect(runner.state.datasource).toEqual({ uid: '-- Dashboard --' });
  });

  // Both datasources have an undefined uid, so a uid-only comparison would wrongly call these the
  // same datasource — the type has to be compared too.
  it('flips to Mixed when type-only datasource references disagree', () => {
    const runner = new SceneQueryRunner({ queries: [] });

    setQueryRunnerQueries(runner, [queryWithType('A', 'prometheus'), queryWithType('B', 'loki')]);

    expect(runner.state.datasource).toEqual({ uid: '-- Mixed --', type: 'mixed' });
  });

  it('writes the queries themselves through unchanged', () => {
    const runner = new SceneQueryRunner({ queries: [] });
    const queries = [query('A', 'default-uid')];

    setQueryRunnerQueries(runner, queries);

    expect(runner.state.queries).toBe(queries);
  });
});
