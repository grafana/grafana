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
  it('matches a receiver title to its contact point and the selector value (uid when it has one)', async () => {
    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.contactPoint).not.toBeNull());
    expect(result.current.contactPoint?.spec.title).toBe('slack-oncall');
    expect(result.current.selectorValue).toBe('uid-1');
  });

  it('has no contact point for a title that matches none', async () => {
    const { result } = renderResolved('gone');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ contactPoint: null, selectorValue: null, isNotFound: true });
  });

  it('is not "not found" while the list is still loading', () => {
    const { result } = renderResolved('slack-oncall');

    expect(result.current.isNotFound).toBe(false);
  });

  it('is not "not found" when the list failed to load', async () => {
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
  });

  it('has no contact point when no receiver is given', async () => {
    const { result } = renderResolved(undefined);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ contactPoint: null, selectorValue: null, isNotFound: false });
  });

  it('reports a failed fetch', async () => {
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('keeps the resolved contact point, without an error, when a later refetch fails', async () => {
    // useListContactPoints shares the cache entry, so its status tells us when the failed refetch has landed.
    const { result } = renderHook(
      () => ({ resolved: useResolvedContactPoint('slack-oncall'), list: useListContactPoints() }),
      { wrapper: getDefaultWrapper() }
    );
    await waitFor(() => expect(result.current.resolved.contactPoint).not.toBeNull());

    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));
    const dispatch = store.dispatch as ThunkDispatch<unknown, unknown, UnknownAction>;
    await act(async () => {
      await dispatch(notificationsAPI.endpoints.listReceiver.initiate({}, { forceRefetch: true }));
    });

    await waitFor(() => expect(result.current.list.isError).toBe(true));
    expect(result.current.resolved.contactPoint?.spec.title).toBe('slack-oncall');
    expect(result.current.resolved.isError).toBe(false);
  });

  it('recovers on window focus after the initial fetch failed', async () => {
    const stopListening = setupListeners(store.dispatch);
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));
    const { result } = renderResolved('slack-oncall');
    await waitFor(() => expect(result.current.isError).toBe(true));

    server.use(listReceiverHandler(ListReceiverApiResponseFactory.build({ items: [withUid] })));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.contactPoint).not.toBeNull());
    expect(result.current.isError).toBe(false);
    stopListening();
  });
});
