import { useCallback } from 'react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { useAddAssistantReplyMutation } from '../api/pulseApi';
import { type PulseBody } from '../types';
import { bodyToText, collectMentions } from '../utils/body';

/** Origin string for Assistant analytics — namespaced per the package's
 *  convention (`<namespace>/<surface>`). */
const ASSISTANT_REPLY_ORIGIN = 'grafana/pulse/assistant-reply';

export interface AssistantReplyContext {
  threadUID: string;
  /** The pulse that tagged the assistant; the reply threads under it. */
  parentUID?: string;
  /** Dashboard the thread is attached to. Surfaced to the assistant as a
   *  link + UID so it can fetch and inspect the dashboard with its own
   *  tools. Omit on non-dashboard resources. */
  dashboardUID?: string;
  /** Human-readable dashboard title, when the surface knows it. Falls back
   *  to the UID in the prompt when absent. */
  dashboardTitle?: string;
  /** Panel the thread is anchored to, if any. When absent, the hook falls
   *  back to the first `#panel` chip in the body so a `#panel`-tagged pulse
   *  still points the assistant at the right panel. */
  panelId?: number;
  /** The panel the Pulse drawer is currently scoped to (e.g. the user
   *  opened "Pulse on this panel" or the panel's title-bar icon). Used as a
   *  last-resort panel signal — lower priority than an explicit anchor or a
   *  `#panel` chip — so "open Pulse on a panel, ask @assistant" tells the
   *  assistant which panel even when the user didn't add a chip. This only
   *  informs the prompt; it does not anchor the thread. */
  fallbackPanelId?: number;
  /** Explicit title for `panelId`, when the caller already has it. */
  panelTitle?: string;
  /** Live panel-id → title map for the dashboard. Preferred source for the
   *  panel title so the prompt names the panel by its current title (the
   *  same rename-resilient map the renderer uses), rather than a stale chip
   *  label. */
  panelTitlesById?: ReadonlyMap<number, string>;
  /** Resolver for a panel's current configuration, used to embed what the
   *  panel actually shows into the prompt. The inline assistant is a plain
   *  LLM call with no dashboard access — it can't open the dashboard or run
   *  tools — so config we don't hand it, it can't see. Supplied by the scene
   *  layer (which holds the live `VizPanel`); omitted on surfaces without
   *  scene access, where the prompt degrades to naming the panel only. */
  getPanelSnapshot?: (panelId: number) => PanelSnapshot | undefined;
  /** Prior messages in the thread, oldest-first, with the tagging pulse
   *  excluded (it becomes the question). The inline assistant has no
   *  retrieval — it can't read the thread itself — so the discussion it
   *  reasons over is only what we fold in here. Omit to send just the
   *  question (the original behaviour). */
  transcript?: TranscriptEntry[];
}

/** TranscriptEntry is one prior thread message flattened for the prompt.
 *  The surface resolves the author label (it owns that logic and the live
 *  user data) so the hook only has to render. */
export interface TranscriptEntry {
  /** Display label for the message author, e.g. "Alice" or a fallback id. */
  author: string;
  /** Plain-text message body. */
  text: string;
  /** True for the assistant's own earlier replies, so the prompt labels
   *  them as the assistant's turns rather than a user named "Assistant". */
  isAssistant: boolean;
}

/** PanelSnapshot is the slice of a panel's configuration worth handing to
 *  the assistant so it can reason about what the panel shows. Every field
 *  is optional — the formatter emits only what's present. */
export interface PanelSnapshot {
  /** Panel plugin id, e.g. "timeseries", "stat", "gauge". */
  panelType?: string;
  /** Author-written panel description, when set. */
  description?: string;
  /** Datasource type backing the queries, e.g. "prometheus", "loki". */
  datasourceType?: string;
  /** Human-readable query expressions (PromQL/LogQL/SQL/…), best-effort
   *  pulled from each target's expression field, prefixed with its refId. */
  queries?: string[];
  /** Display unit, e.g. "bytes", "percent". */
  unit?: string;
  /** Threshold steps formatted as "value:color", ascending. */
  thresholds?: string[];
}

/** bodyTagsAssistant reports whether a composed body contains an
 *  `@assistant` mention — the trigger for an auto-reply. */
export function bodyTagsAssistant(body: PulseBody): boolean {
  return collectMentions(body).some((m) => m.kind === 'assistant');
}

/**
 * useAssistantAutoReply returns a function to call after a pulse is posted.
 * When that pulse tagged `@assistant`, it asks the Grafana Assistant (via
 * the package's inline generation API — the same backend the sidebar chat
 * uses) to answer, then posts the answer into the thread as the assistant
 * service account.
 *
 * Generation is intentionally client-side: Grafana's backend has no LLM, so
 * the assistant answer is produced in the browser and persisted through the
 * `assistant-reply` endpoint. The whole thing is best-effort — failures and
 * an unavailable assistant degrade to a short fallback notice rather than
 * surfacing an error over the user's own (already successful) pulse.
 */
export function useAssistantAutoReply(): (body: PulseBody, ctx: AssistantReplyContext) => Promise<void> {
  const { isAvailable } = useAssistant();
  const { generate } = useInlineAssistant();
  const [addAssistantReply] = useAddAssistantReplyMutation();

  return useCallback(
    async (body: PulseBody, ctx: AssistantReplyContext): Promise<void> => {
      if (!bodyTagsAssistant(body)) {
        return;
      }

      // Post exactly once across the streaming success path, the error
      // callback, and the throw path.
      let posted = false;
      const postOnce = (markdown: string) => {
        const trimmed = markdown.trim();
        if (posted || trimmed.length === 0) {
          return;
        }
        posted = true;
        addAssistantReply({ threadUID: ctx.threadUID, req: { parentUID: ctx.parentUID, markdown: trimmed } })
          .unwrap()
          .catch(() => {
            // best-effort — the user's pulse already landed.
          });
      };

      if (!isAvailable) {
        postOnce(assistantUnavailableMessage());
        return;
      }

      try {
        await generate({
          prompt: buildPrompt(body, ctx),
          origin: ASSISTANT_REPLY_ORIGIN,
          systemPrompt: assistantSystemPrompt(),
          onComplete: (text) => postOnce(text),
          onError: () => postOnce(assistantUnavailableMessage()),
        });
      } catch {
        postOnce(assistantUnavailableMessage());
      }
    },
    [isAvailable, generate, addAssistantReply]
  );
}

/** buildPrompt turns the tagging pulse into the assistant prompt: a context
 *  preamble that names the dashboard/panel under discussion (and embeds the
 *  panel's config, since the tool-less assistant can't fetch it), then the
 *  thread's discussion so far, then the user's question with the
 *  `@assistant` chip text stripped out. */
function buildPrompt(body: PulseBody, ctx: AssistantReplyContext): string {
  let question = bodyToText(body);
  for (const m of collectMentions(body)) {
    if (m.kind === 'assistant') {
      question = question.split('@' + (m.displayName ?? m.targetId)).join(' ');
    }
  }
  question = question.trim();
  if (question.length === 0) {
    question = t('pulse.assistant.empty-prompt', 'Please help with this dashboard conversation.');
  }

  const contextLine = buildContextLine(body, ctx);
  const history = formatTranscript(ctx.transcript);
  // Order: panel/dashboard context, the discussion so far, then the
  // question — so the prompt's "answer from the panel details above and the
  // discussion" instruction has a discussion to point at.
  return [contextLine, history, question].filter(Boolean).join('\n\n');
}

/** Most recent prior messages to include in the prompt. Bounds prompt size
 *  on long threads; the inline assistant has no retrieval to fetch the rest,
 *  so we keep the freshest context and note what was dropped. */
const MAX_HISTORY_MESSAGES = 20;

/** formatTranscript renders prior thread messages as a plain-text block,
 *  one "Author: text" line each, capped to the most recent messages. Returns
 *  an empty string when there's nothing usable to include. */
function formatTranscript(entries?: TranscriptEntry[]): string {
  const usable = (entries ?? []).filter((e) => e.text.trim().length > 0);
  if (usable.length === 0) {
    return '';
  }
  const recent = usable.slice(-MAX_HISTORY_MESSAGES);
  const omitted = usable.length - recent.length;
  const header =
    omitted > 0
      ? t(
          'pulse.assistant.history-truncated',
          'Earlier in this conversation ({{omitted}} older message(s) omitted):',
          { omitted }
        )
      : t('pulse.assistant.history', 'Earlier in this conversation:');
  const selfLabel = t('pulse.assistant.history-self-label', 'Assistant');
  const lines = recent.map((e) => `${e.isAssistant ? selfLabel : e.author}: ${e.text.trim()}`);
  return `${header}\n${lines.join('\n')}`;
}

/** buildContextLine describes the dashboard (and panel, when known) the
 *  thread is about, with a navigable link so the assistant can fetch it. */
function buildContextLine(body: PulseBody, ctx: AssistantReplyContext): string | undefined {
  if (!ctx.dashboardUID) {
    return undefined;
  }
  const dashboardTitle = ctx.dashboardTitle?.trim() || ctx.dashboardUID;

  // Panel signal, most-to-least explicit: the thread's anchored panel, then
  // a `#panel` chip in the pulse, then the panel the drawer is scoped to
  // (the user opened Pulse on it). The drawer scope is the catch-all so
  // "open Pulse on a panel and ask @assistant" still names that panel.
  const panelMention = collectMentions(body).find((m) => m.kind === 'panel');
  let panelId = ctx.panelId;
  if (panelId === undefined && panelMention) {
    const parsed = Number(panelMention.targetId);
    if (Number.isFinite(parsed)) {
      panelId = parsed;
    }
  }
  if (panelId === undefined) {
    panelId = ctx.fallbackPanelId;
  }
  // Resolve the panel's title so the prompt names exactly what the user
  // means. The live title map wins (current name even after a rename), then
  // an explicit caller-supplied title, then the chip's stored label.
  let panelTitle: string | undefined;
  if (panelId !== undefined) {
    panelTitle = ctx.panelTitlesById?.get(panelId) ?? ctx.panelTitle ?? panelMention?.displayName;
  }

  const link = dashboardLink(ctx.dashboardUID, panelId);

  // The inline assistant is a bare LLM call: no tools, no dashboard access,
  // no ability to fetch a URL. Earlier prompts that told it to "open the
  // link" or "use your dashboard tools" asked for things it can't do — it
  // would try to HTTP-fetch an unreachable config.appUrl, or reply that it
  // has no such tools. So instead we *hand it* the panel's configuration
  // inline (the only knowledge it can have), and the link stays a plain
  // human reference for whoever reads the thread.
  //
  // escapeValue:false keeps the embedded config, URL, and any "/" or "&" in
  // titles intact — this string is an LLM prompt, not HTML, so i18next's
  // default entity-escaping would corrupt the values.
  if (panelId !== undefined) {
    const snapshot = ctx.getPanelSnapshot?.(panelId);
    const configText = snapshot ? formatPanelSnapshot(snapshot) : '';
    const panelConfig = configText
      ? `\n\nThe panel's current configuration:\n${configText}`
      : '';
    return t(
      'pulse.assistant.context-panel',
      'This question is from a Grafana Pulse conversation about the panel "{{panelTitle}}" (panel id {{panelId}}) on the dashboard "{{dashboardTitle}}".{{panelConfig}}\n\nYou are replying inside the conversation thread and cannot open the dashboard or run its queries yourself, so answer from the panel details above and the discussion. If you need data values or specifics you have not been given, ask the user. A reference link for the user: {{link}}',
      {
        panelTitle: panelTitle || `#${panelId}`,
        panelId,
        dashboardTitle,
        panelConfig,
        link,
        interpolation: { escapeValue: false },
      }
    );
  }
  return t(
    'pulse.assistant.context-dashboard',
    'This question is from a Grafana Pulse conversation on the dashboard "{{dashboardTitle}}". You are replying inside the conversation thread and cannot open the dashboard yourself, so answer from the discussion. If you need specifics about the dashboard you have not been given, ask the user. A reference link for the user: {{link}}',
    { dashboardTitle, link, interpolation: { escapeValue: false } }
  );
}

/** formatPanelSnapshot renders a PanelSnapshot as a compact, plain-text
 *  block for the prompt. Plain English (not translated): it's structured
 *  data fed to the model, which is itself prompted in English. */
function formatPanelSnapshot(s: PanelSnapshot): string {
  const lines: string[] = [];
  if (s.panelType) {
    lines.push(`- Visualization type: ${s.panelType}`);
  }
  if (s.description) {
    lines.push(`- Description: ${s.description}`);
  }
  if (s.datasourceType) {
    lines.push(`- Datasource type: ${s.datasourceType}`);
  }
  if (s.queries && s.queries.length > 0) {
    lines.push('- Queries:');
    for (const q of s.queries) {
      lines.push(`    ${q}`);
    }
  }
  if (s.unit) {
    lines.push(`- Unit: ${s.unit}`);
  }
  if (s.thresholds && s.thresholds.length > 0) {
    lines.push(`- Thresholds: ${s.thresholds.join(', ')}`);
  }
  return lines.join('\n');
}

/** dashboardLink builds an absolute dashboard URL (optionally focused on a
 *  panel via `viewPanel`) so the link resolves regardless of where the
 *  assistant renders it. config.appUrl carries a trailing slash. */
function dashboardLink(dashboardUID: string, panelId?: number): string {
  const base = `${config.appUrl}d/${encodeURIComponent(dashboardUID)}`;
  return panelId !== undefined ? `${base}?viewPanel=${panelId}` : base;
}

function assistantSystemPrompt(): string {
  return t(
    'pulse.assistant.system-prompt',
    'You are the Grafana Assistant replying inside a dashboard conversation thread. Answer concisely and helpfully in Markdown.'
  );
}

function assistantUnavailableMessage(): string {
  return t(
    'pulse.assistant.unavailable',
    "I'm the Grafana Assistant, but I'm not available in this Grafana instance right now, so I can't answer here."
  );
}
