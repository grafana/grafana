import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper, store } from '../../../../tests/provider';
import { notificationsAPI } from '../../api/notifications';
import {
  ListTimeIntervalApiResponseFactory,
  TimeIntervalFactory,
} from '../../api/notifications/v1beta1/mocks/fakes/TimeIntervals';
import { listTimeIntervalHandler } from '../../api/notifications/v1beta1/mocks/handlers/TimeIntervalHandlers/listTimeIntervalHandler';

import { useListTimeIntervals } from './useListTimeIntervals';

const server = setupMockServer();

function serveIntervals(...items: Array<ReturnType<typeof TimeIntervalFactory.build>>) {
  server.use(listTimeIntervalHandler(ListTimeIntervalApiResponseFactory.build({ items })));
}

function renderList() {
  return renderHook(() => useListTimeIntervals(), { wrapper: getDefaultWrapper() });
}

describe('useListTimeIntervals', () => {
  it('maps each interval to the title rules reference it by and whether it was imported', async () => {
    serveIntervals(TimeIntervalFactory.build({ metadata: { name: 'uid-1' }, spec: { name: 'business-hours' } }));

    const { result } = renderList();

    expect(result.current.status).toBe('resolving');
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.timeIntervals).toEqual([{ name: 'business-hours', isImported: false }]);
  });

  it('marks an interval flagged as not usable as imported', async () => {
    serveIntervals(
      TimeIntervalFactory.build({
        metadata: { annotations: { 'grafana.com/canUse': 'false' } },
        spec: { name: 'imported' },
      })
    );

    const { result } = renderList();

    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));
    expect(result.current.timeIntervals[0]).toEqual({ name: 'imported', isImported: true });
  });

  it('treats an interval without the canUse annotation as imported', async () => {
    // Built then stripped: factory params are deep-merged into the default annotation.
    const unannotated = TimeIntervalFactory.build({ spec: { name: 'unannotated' } });
    delete unannotated.metadata.annotations;
    serveIntervals(unannotated);

    const { result } = renderList();

    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));
    expect(result.current.timeIntervals[0].isImported).toBe(true);
  });

  it('returns the same array across rerenders while the data is unchanged', async () => {
    serveIntervals(TimeIntervalFactory.build({ spec: { name: 'weekends' } }));
    const { result, rerender } = renderList();
    const whileLoading = result.current.timeIntervals;
    rerender();
    expect(result.current.timeIntervals).toBe(whileLoading);

    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));
    const loaded = result.current.timeIntervals;
    rerender();
    expect(result.current.timeIntervals).toBe(loaded);
  });

  it('reports a failed fetch', async () => {
    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderList();

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.timeIntervals).toEqual([]);
  });

  it('keeps the loaded intervals, without an error, when a later refetch fails', async () => {
    serveIntervals(TimeIntervalFactory.build({ spec: { name: 'weekends' } }));
    const { result } = renderList();
    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));

    server.use(listTimeIntervalHandler(() => new HttpResponse(null, { status: 500 })));
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listTimeInterval.initiate({}, { forceRefetch: true }));
    });

    expect(result.current.timeIntervals.map((interval) => interval.name)).toEqual(['weekends']);
    expect(result.current.status).toBe('found');
  });

  it('makes no request while skipped, and loads once it is no longer skipped', async () => {
    const requested = jest.fn();
    server.use(
      listTimeIntervalHandler(() => {
        requested();
        return HttpResponse.json(
          ListTimeIntervalApiResponseFactory.build({
            items: [TimeIntervalFactory.build({ spec: { name: 'weekends' } })],
          })
        );
      })
    );

    const { result, rerender } = renderHook(({ skip }) => useListTimeIntervals({ skip }), {
      wrapper: getDefaultWrapper(),
      initialProps: { skip: true },
    });

    expect(requested).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: 'skipped', timeIntervals: [] });

    rerender({ skip: false });

    await waitFor(() => expect(result.current.timeIntervals).toHaveLength(1));
    expect(requested).toHaveBeenCalledTimes(1);
  });
});
