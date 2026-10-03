import { act, render, screen } from '@testing-library/react';

import { dateTime } from '@grafana/data';

import { GraphiteDatasource } from '../datasource';
import gfunc from '../gfunc';

import { GraphiteQueryEditorContext, useGraphiteState } from './context';

function StateProbe() {
  const state = useGraphiteState();

  return (
    <>
      <div data-testid="target">{state.target?.target ?? 'missing'}</div>
      <div data-testid="queries">{JSON.stringify(state.queries)}</div>
    </>
  );
}

describe('GraphiteQueryEditorContext', () => {
  it('preserves query updates while initialization is pending', async () => {
    let resolveInitialization!: () => void;

    const initialization = new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    });

    let resolveQueryUpdate!: () => void;

    const queryUpdate = new Promise<void>((resolve) => {
      resolveQueryUpdate = resolve;
    });

    const datasource = new GraphiteDatasource({
      url: '/api/datasources/proxy/1',
      name: 'graphiteProd',
      jsonData: {
        rollupIndicatorEnabled: true,
      },
    });

    datasource.funcDefs = gfunc.getFuncDefs('1.0');
    datasource.metricFindQuery = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => queryUpdate.then(() => []))
      .mockResolvedValue([]);
    datasource.getFuncDef = gfunc.getFuncDef;
    datasource.createFuncInstance = gfunc.createFuncInstance;
    datasource.waitForFuncDefsLoaded = jest.fn(() => initialization);

    const query = {
      refId: 'A',
      target: 'initial.metric',
    };

    const range = {
      from: dateTime('2026-09-15T18:00:00Z'),
      to: dateTime('2026-09-15T19:00:00Z'),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    const props = {
      datasource,
      onChange: jest.fn(),
      onRunQuery: jest.fn(),
      queries: [query],
      range,
    };

    const { rerender } = render(
      <GraphiteQueryEditorContext {...props} query={query}>
        <StateProbe />
      </GraphiteQueryEditorContext>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('target')).not.toBeInTheDocument();

    const updatedQuery = {
      ...query,
      target: 'updated.metric',
    };

    const updatedQueries = [
      {
        ...query,
        target: 'updated.queries.metric',
      },
    ];

    rerender(
      <GraphiteQueryEditorContext {...props} query={updatedQuery} queries={updatedQueries}>
        <StateProbe />
      </GraphiteQueryEditorContext>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('target')).not.toBeInTheDocument();
    expect(datasource.waitForFuncDefsLoaded).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveInitialization();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      resolveQueryUpdate();
      await queryUpdate;
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByTestId('target')).toHaveTextContent('updated.metric');
    expect(screen.getByTestId('queries')).toHaveTextContent('updated.queries.metric');
    expect(datasource.waitForFuncDefsLoaded).toHaveBeenCalledTimes(1);
  });
});
