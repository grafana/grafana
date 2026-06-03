import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { isAssistantAvailable, useInlineAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { DashboardInteractions } from '../utils/interactions';

import { CommentCompose } from './CommentCompose';
import { CommentPin } from './CommentPin';
import { CommentThreadView } from './CommentThread';
import { useComments } from './CommentsStore';
import { findPanelAtPoint, fromNormalized, getPanelRect, toNormalized } from './anchor';
import { recordAssistantChatFromSidebar } from './assistantChatRegistry';
import { resolveToMs } from './formatTime';
import { parseCommentMentions } from './mentions';
import { processCommentMentions } from './useCommentAssistantActions';

interface Props {
  dashboardUid: string;
  dashboardTitle?: string;
}

interface Provisional {
  panelKey: string;
  panelTitle: string;
  xNorm: number;
  yNorm: number;
  clientX: number;
  clientY: number;
}

export function CommentsOverlay({ dashboardUid, dashboardTitle }: Props) {
  const location = useLocation();
  const styles = useStyles2(getStyles);

  const params = new URLSearchParams(location.search);
  const featureEnabled = Boolean(config.featureToggles.dashboardComments);
  const enabled = featureEnabled && params.get('comments') === '1';
  const urlThreadId = params.get('thread');

  const [provisional, setProvisional] = useState<Provisional | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(urlThreadId ? Number(urlThreadId) : null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setTick] = useState(0);

  const { threads, addThread, appendMessage, setResolved, deleteThread } = useComments(dashboardUid);
  const { generate } = useInlineAssistant();
  const [assistantAvailable, setAssistantAvailable] = useState(false);

  useEffect(() => {
    const sub = isAssistantAvailable().subscribe(setAssistantAvailable);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string; title?: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }>).detail;
      if (detail?.chatId && detail.messages?.length) {
        recordAssistantChatFromSidebar(detail.chatId, detail.title ?? 'Assistant chat', detail.messages);
      }
    };
    window.addEventListener('grafana-assistant-chat-snapshot', handler);
    return () => window.removeEventListener('grafana-assistant-chat-snapshot', handler);
  }, []);

  useEffect(() => {
    const parsed = urlThreadId ? Number(urlThreadId) : null;
    setActiveThreadId(parsed);
    if (parsed) {
      const rect = getPanelRect(threads.find((t) => t.id === parsed)?.anchor.panelKey ?? '');
      if (rect) {
        window.scrollTo({ top: window.scrollY + rect.top - 200, behavior: 'smooth' });
      }
    }
  }, [urlThreadId, threads]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    function bump() {
      setTick((t) => t + 1);
    }
    window.addEventListener('resize', bump);
    window.addEventListener('scroll', bump, true);
    return () => {
      window.removeEventListener('resize', bump);
      window.removeEventListener('scroll', bump, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || provisional || activeThreadId) {
      return;
    }
    function onDocClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) {
        return;
      }
      if (target.closest('[data-comments-overlay]')) {
        return;
      }
      const hit = findPanelAtPoint(e.clientX, e.clientY);
      if (!hit) {
        return;
      }
      const { xNorm, yNorm } = toNormalized(hit.rect, e.clientX, e.clientY);
      setProvisional({
        panelKey: hit.key,
        panelTitle: hit.title,
        xNorm,
        yNorm,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [enabled, provisional, activeThreadId]);

  if (!enabled) {
    return null;
  }

  async function submitProvisional(rawBody: string) {
    if (!provisional) {
      return;
    }
    const fromRaw = params.get('from') ?? '';
    const toRaw = params.get('to') ?? '';
    const fromMs = resolveToMs(fromRaw);
    const toMs = resolveToMs(toRaw, true);
    const timeRange = {
      from: fromMs !== null ? String(fromMs) : fromRaw,
      to: toMs !== null ? String(toMs) : toRaw,
    };
    const parsed = parseCommentMentions(rawBody);
    let initialBody = parsed.cleanBody;
    if (!initialBody) {
      initialBody =
        parsed.assistantQuestion || parsed.chatId || parsed.chatMentionWithoutId ? rawBody.trim() : '';
    }
    if (!initialBody) {
      return;
    }
    const pin = {
      dashboardUid,
      dashboardTitle,
      panelKey: provisional.panelKey,
      panelTitle: provisional.panelTitle,
      timeRange,
    };

    const created = await addThread({
      anchor: { panelKey: provisional.panelKey, xNorm: provisional.xNorm, yNorm: provisional.yNorm },
      context: {
        panelTitle: provisional.panelTitle,
        timeRange,
      },
      body: initialBody,
    });
    if (created) {
      DashboardInteractions.commentCreated({
        dashboard_uid: dashboardUid,
        panel_key: provisional.panelKey,
        thread_count: threads.length + 1,
      });

      const hasMentions =
        assistantAvailable &&
        (parsed.assistantQuestion || parsed.chatId || parsed.chatMentionWithoutId);
      if (hasMentions) {
        await processCommentMentions({
          pin,
          thread: created,
          rawBody,
          generate,
          skipUserMessage: true,
          appendUserMessage: async () => undefined,
          appendAssistantMessage: async (body) => {
            await appendMessage(created.id, { body, authorType: 'assistant' });
          },
        });
      }
    }
    setProvisional(null);
  }

  function closeActiveThread() {
    setActiveThreadId(null);
    if (urlThreadId) {
      locationService.partial({ thread: null });
    }
  }

  function jumpTo(threadId: number, range: { from: string; to: string }) {
    DashboardInteractions.commentJumpTo({ dashboard_uid: dashboardUid, thread_id: threadId });
    locationService.partial({ from: range.from, to: range.to });
  }

  const activeThread = activeThreadId ? threads.find((t) => t.id === activeThreadId) ?? null : null;
  const activeIndex = activeThread ? threads.findIndex((t) => t.id === activeThread.id) : -1;
  let activePos: { x: number; y: number } | null = null;
  if (activeThread) {
    const rect = getPanelRect(activeThread.anchor.panelKey);
    if (rect) {
      activePos = fromNormalized(rect, activeThread.anchor.xNorm, activeThread.anchor.yNorm);
    }
  }

  return (
    <div className={styles.root} data-comments-overlay={dashboardUid || 'unknown'}>
      <style>{`[data-viz-panel-key] { cursor: crosshair; }`}</style>

      {threads.map((thread) => {
        const rect = getPanelRect(thread.anchor.panelKey);
        if (!rect) {
          return null;
        }
        const pos = fromNormalized(rect, thread.anchor.xNorm, thread.anchor.yNorm);
        const displayNumber = threads.findIndex((t) => t.id === thread.id) + 1;
        return (
          <CommentPin
            key={thread.id}
            number={displayNumber}
            x={pos.x}
            y={pos.y}
            resolved={thread.resolved}
            onClick={() => {
              setProvisional(null);
              setActiveThreadId(thread.id);
            }}
          />
        );
      })}

      {provisional && (
        <>
          <CommentPin number={threads.length + 1} x={provisional.clientX} y={provisional.clientY} />
          <CommentCompose
            x={provisional.clientX}
            y={provisional.clientY}
            pin={{
              dashboardUid,
              dashboardTitle,
              panelKey: provisional.panelKey,
              panelTitle: provisional.panelTitle,
              timeRange: {
                from: params.get('from') ?? '',
                to: params.get('to') ?? '',
              },
            }}
            onSubmit={submitProvisional}
            onCancel={() => setProvisional(null)}
          />
        </>
      )}

      {activeThread && activePos && (
        <CommentThreadView
          dashboardUid={dashboardUid}
          dashboardTitle={dashboardTitle}
          thread={activeThread}
          number={activeIndex + 1}
          x={activePos.x}
          y={activePos.y}
          appendMessage={appendMessage}
          onReply={async (body) => {
            const msg = await appendMessage(activeThread.id, { body });
            if (msg) {
              DashboardInteractions.commentReplied({ dashboard_uid: dashboardUid, thread_id: activeThread.id });
            }
          }}
          onToggleResolve={async () => {
            const next = !activeThread.resolved;
            await setResolved(activeThread.id, next);
            if (next) {
              DashboardInteractions.commentResolved({ dashboard_uid: dashboardUid, thread_id: activeThread.id });
            } else {
              DashboardInteractions.commentReopened({ dashboard_uid: dashboardUid, thread_id: activeThread.id });
            }
          }}
          onDelete={async () => {
            await deleteThread(activeThread.id);
            DashboardInteractions.commentDeleted({ dashboard_uid: dashboardUid, thread_id: activeThread.id });
            closeActiveThread();
          }}
          onJumpTo={() => jumpTo(activeThread.id, activeThread.context.timeRange)}
          onClose={closeActiveThread}
        />
      )}
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  root: css({
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 9999,
  }),
});
