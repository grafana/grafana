import { act, render, screen } from '@testing-library/react';

import { dateTime, type TimeRange } from '@grafana/data';

import { GraphiteDatasource } from '../datasource';
import gfunc from '../gfunc';
import { type GraphiteQuery } from '../types';

import { GraphiteQueryEditorContext, useGraphiteState } from './context';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ replace: (value: string) => value, getVariables: () => [] }),
}));

const makeRange = (from: string): TimeRange => ({
  from: dateTime(),
  to: dateTime(),
  raw: { from, to: 'now' },
});

const Target = () => {
  const state = useGraphiteState();
  return <div>{state.target.target}</div>;
};

describe('GraphiteQueryEditorContext', () => {
  it('applies query changes made while init is pending', async () => {
    const datasource = new GraphiteDatasource({ url: '/api/datasources/proxy/1', name: 'graphite', jsonData: {} });
    datasource.metricFindQuery = jest.fn(() => Promise.resolve([]));
    datasource.getFuncDef = gfunc.getFuncDef;
    datasource.createFuncInstance = gfunc.createFuncInstance;
    let resolveFuncDefs: (value: unknown) => void = () => {};
    datasource.waitForFuncDefsLoaded = jest.fn(() => new Promise((resolve) => (resolveFuncDefs = resolve)));

    const props = {
      datasource,
      onRunQuery: jest.fn(),
      onChange: jest.fn(),
      queries: [],
    };
    const query: GraphiteQuery = { refId: 'A', target: 'test.prod.*' };

    const { rerender } = render(
      <GraphiteQueryEditorContext {...props} query={query} range={makeRange('now-1h')}>
        <Target />
      </GraphiteQueryEditorContext>
    );

    await act(async () => {
      rerender(
        <GraphiteQueryEditorContext
          {...props}
          query={{ ...query, target: 'new.metrics.*' }}
          range={makeRange('now-6h')}
        >
          <Target />
        </GraphiteQueryEditorContext>
      );
    });

    expect(datasource.waitForFuncDefsLoaded).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFuncDefs(null);
    });

    expect(await screen.findByText('new.metrics.*')).toBeInTheDocument();
  });
});
