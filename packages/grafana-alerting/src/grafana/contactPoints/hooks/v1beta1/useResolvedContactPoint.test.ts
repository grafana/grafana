import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';

import { setupMockServer } from '@grafana/test-utils/server';

import { getDefaultWrapper } from '../../../../../tests/provider';
import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
} from '../../../api/notifications/v1beta1/mocks/fakes/Receivers';
import { listReceiverHandler } from '../../../api/notifications/v1beta1/mocks/handlers/ReceiverHandlers/listReceiverHandler';

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
    expect(result.current).toMatchObject({ contactPoint: null, selectorValue: null });
  });

  it('has no contact point when no receiver is given', async () => {
    const { result } = renderResolved(undefined);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ contactPoint: null, selectorValue: null });
  });

  it('reports a failed fetch', async () => {
    server.use(listReceiverHandler(() => new HttpResponse(null, { status: 500 })));

    const { result } = renderResolved('slack-oncall');

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
