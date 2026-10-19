import { type ThunkDispatch, type UnknownAction } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper, store } from '../../../../../tests/provider';
import { notificationsAPI } from '../../../api/notifications';
import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Receivers';
import { listReceiverHandler } from '../../../api/notifications/v1beta1/mocks/handlers/ReceiverHandlers/listReceiverHandler';

import { useListContactPoints } from './useContactPoints';
import { useResolvedContactPoint } from './useResolvedContactPoint';

const server = setupMockServer();

const withUid = ContactPointFactory.build({ metadata: { uid: 'uid-1' }, spec: { title: 'slack-oncall' } });

beforeEach(() => {
  server.use(listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [withUid] })));
});

function renderResolved(receiver?: string) {
  return renderHook(() => useResolvedContactPoint(receiver), { wrapper: getDefaultWrapper() });
}

describe('useResolvedContactPoint', () => {
  it('finds the contact point for a receiver title and returns the selector value (the uid when it has one)', async () => {
    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.selectorValue).toBe('uid-1');
  });

  it('is not found for a title that matches none', async () => {
    const { result } = renderResolved('gone');

    await waitFor(() => expect(result.current.status).toBe('notFound'));
    expect(result.current.selectorValue).toBeNull();
  });

  it('is unusable, with no selector value, for a contact point that cannot be used', async () => {
    const imported = ContactPointFactory.build({
      metadata: { uid: 'uid-2', annotations: { 'grafana.com/canUse': 'false' } },
      spec: { title: 'imported' },
    });
    server.use(listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [withUid, imported] })));

    const { result } = renderResolved('imported');

    await waitFor(() => expect(result.current.status).toBe('unusable'));
    expect(result.current.selectorValue).toBeNull();
  });

  it('is resolving until the list has loaded', async () => {
    const { result } = renderResolved('slack-oncall');

    expect(result.current.status).toBe('resolving');
    expect(result.current.selectorValue).toBeNull();

    await waitFor(() => expect(result.current.status).toBe('found'));
  });

  it('is idle when no receiver is given', async () => {
    const { result } = renderHook(
      () => ({ resolved: useResolvedContactPoint(undefined), list: useListContactPoints() }),
      {
        wrapper: getDefaultWrapper(),
      }
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.resolved).toEqual({ status: 'idle', selectorValue: null });
  });

  it('reports an error when the list failed to load, not "not found"', async () => {
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.selectorValue).toBeNull();
  });

  it('reports an error even when no receiver is given', async () => {
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderResolved(undefined);

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('keeps the resolved selector value, without an error, when a later refetch fails', async () => {
    // useListContactPoints shares the cache entry, so its status tells us when the failed refetch has landed.
    const { result } = renderHook(
      () => ({ resolved: useResolvedContactPoint('slack-oncall'), list: useListContactPoints() }),
      { wrapper: getDefaultWrapper() }
    );
    await waitFor(() => expect(result.current.resolved.status).toBe('found'));

    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listReceiver.initiate({}, { forceRefetch: true }));
    });

    await waitFor(() => expect(result.current.list.isError).toBe(true));
    expect(result.current.resolved).toEqual({ status: 'found', selectorValue: 'uid-1' });
  });

  it('recovers on window focus after the initial fetch failed', async () => {
    const stopListening = setupListeners(store.dispatch);
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));
    const { result } = renderResolved('slack-oncall');
    await waitFor(() => expect(result.current.status).toBe('error'));

    server.use(listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [withUid] })));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(result.current.selectorValue).toBe('uid-1');
    stopListening();
  });
});
