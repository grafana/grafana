import { type FieldConfigSource } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { DashboardDiscardedEvent, DashboardSavedEvent } from 'app/types/events';

import { defaultOptions, type Options, TextMode } from '../panelcfg.gen';

import { TextPanelInteractions } from './main';
import { type TextPanelEditorView, type TextPanelSavedProperties } from './types';

/** What the panel captures while the author edits, read once on save. */
export interface TextPanelSnapshot {
  options: Options;
  fieldConfig: FieldConfigSource;
  newFeaturesEnabled: boolean;
  /** Summarised by the panel, so a pending report holds no reference to query data. */
  hasData: boolean;
  editorViewAtSave: TextPanelEditorView;
  editorViewChanged: boolean;
  contentChanged: boolean;
}

const MERMAID_RE = /```[ \t]*mermaid\b|class=["'][^"']*\bmermaid\b/i;

// Thresholds and mappings only reach what a reader sees through this macro.
const COLOR_MACRO_RE = /\$\{__[^}]*\.color\b/;

export function deriveSavedProperties(snapshot: TextPanelSnapshot) {
  // An undeclared session property would fail `Exact` at the call site rather than reach the payload.
  const { options, fieldConfig, ...session } = snapshot;

  const content = options.content ?? '';
  const { mappings } = fieldConfig.defaults;

  return {
    ...session,

    mode: options.mode,
    renderMode: options.renderMode ?? defaultOptions.renderMode!,

    // Code mode shows its source verbatim, so Handlebars never runs against it.
    hasHandlebars: options.mode !== TextMode.Code && content.includes('{{'),
    hasMermaid: MERMAID_RE.test(content),
    referencesColor: COLOR_MACRO_RE.test(content),
    hasValueMappings: (mappings?.length ?? 0) > 0,
    // `satisfies` over a return type: `EventProperty`'s index signature would fail `Exact`.
  } satisfies TextPanelSavedProperties;
}

/**
 * Reports each edited text panel on dashboard save, so the numbers describe what authors chose
 * rather than how often a dashboard is viewed.
 */
export class TextPanelSaveTracker {
  private receipts = new Map<number, TextPanelSnapshot>();

  constructor() {
    appEvents?.subscribe?.(DashboardSavedEvent, this.onDashboardSaved);
    appEvents?.subscribe?.(DashboardDiscardedEvent, this.onDashboardDiscarded);
  }

  /** Called on every edit, so the derivation is deferred to save. */
  record(panelId: number, snapshot: TextPanelSnapshot) {
    this.receipts.set(panelId, snapshot);
  }

  /** Drops a panel the author left as they found it, which no discard event would clear. */
  forget(panelId: number) {
    this.receipts.delete(panelId);
  }

  private onDashboardSaved = () => {
    for (const snapshot of this.receipts.values()) {
      try {
        TextPanelInteractions.saved(deriveSavedProperties(snapshot));
      } catch (error) {
        // Reporting must never be able to fail a save.
        console.error('error in text panel tracking handler', error);
      }
    }

    this.receipts.clear();
  };

  private onDashboardDiscarded = () => {
    this.receipts.clear();
  };
}

export const textPanelSaveTracker = new TextPanelSaveTracker();
