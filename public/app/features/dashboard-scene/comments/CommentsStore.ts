import { useCallback, useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';

import { type CommentMessage, type CommentThread, type PinContext, type PinCoord } from './types';

interface ThreadsResponse {
  threads: CommentThread[];
}

export interface UseCommentsResult {
  threads: CommentThread[];
  loading: boolean;
  error: string | null;
  addThread: (args: { anchor: PinCoord; context: PinContext; body: string }) => Promise<CommentThread | null>;
  appendMessage: (threadId: number, args: { body: string; authorType?: 'user' | 'assistant' }) => Promise<CommentMessage | null>;
  setResolved: (threadId: number, resolved: boolean) => Promise<void>;
  deleteThread: (threadId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useComments(dashboardUid: string): UseCommentsResult {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!dashboardUid) {
      setThreads([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await getBackendSrv().get<ThreadsResponse>(
        `/api/dashboards/uid/${encodeURIComponent(dashboardUid)}/comments`
      );
      setThreads(res.threads ?? []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [dashboardUid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addThread = useCallback<UseCommentsResult['addThread']>(
    async ({ anchor, context, body }) => {
      if (!dashboardUid) {
        return null;
      }
      try {
        const created = await getBackendSrv().post<CommentThread>(
          `/api/dashboards/uid/${encodeURIComponent(dashboardUid)}/comments`,
          { anchor, context, body }
        );
        setThreads((prev) => [...prev, created]);
        return created;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      }
    },
    [dashboardUid]
  );

  const appendMessage = useCallback<UseCommentsResult['appendMessage']>(
    async (threadId, { body, authorType = 'user' }) => {
      try {
        const msg = await getBackendSrv().post<CommentMessage>(
          `/api/dashboards/comments/threads/${threadId}/messages`,
          { body, authorType }
        );
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t))
        );
        return msg;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      }
    },
    []
  );

  const setResolved = useCallback<UseCommentsResult['setResolved']>(
    async (threadId, resolved) => {
      try {
        const updated = await getBackendSrv().patch<CommentThread>(
          `/api/dashboards/comments/threads/${threadId}`,
          { resolved }
        );
        setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    []
  );

  const deleteThread = useCallback<UseCommentsResult['deleteThread']>(
    async (threadId) => {
      try {
        await getBackendSrv().delete(`/api/dashboards/comments/threads/${threadId}`);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    []
  );

  return { threads, loading, error, addThread, appendMessage, setResolved, deleteThread, refresh };
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return 'request failed';
}
