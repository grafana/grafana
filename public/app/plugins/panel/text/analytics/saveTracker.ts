import { isEqual } from 'lodash';

import { type FieldConfigSource } from '@grafana/data';
import { appEvents } from 'app/core/app_events';
import { DashboardDiscardedEvent, DashboardSavedEvent } from 'app/types/events';

import { defaultOptions, type Options, TextMode } from '../panelcfg.gen';

import { TextPanelInteractions } from './main';
import { type TextPanelEditorView, type TextPanelSavedProperties } from './types';

/** What the panel reports on every edit, read once on save. */
export interface TextPanelSnapshot {
  /** Resolved template, with the panel defaults already applied. */
  content: string;
  options: Options;
  fieldConfig: FieldConfigSource;
  newFeaturesEnabled: boolean;
  /** Summarised by the panel, so a pending report holds no reference to query data. */
  hasData: boolean;
  editorViewAtSave: TextPanelEditorView;
  editorViewChanged: boolean;
}

const MERMAID_RE = /```[ \t]*mermaid\b|class=["'][^"']*\bmermaid\b/i;

// Thresholds and mappings only reach what a reader sees through this macro.
const COLOR_MACRO_RE = /\$\{__[^}]*\.color\b/;

// Mappings set as a per-field override reach the rendered value just as the defaults do.
function hasValueMappings(fieldConfig: FieldConfigSource): boolean {
  if ((fieldConfig.defaults.mappings?.length ?? 0) > 0) {
    return true;
  }

  return fieldConfig.overrides.some((override) =>
    override.properties.some((prop) => prop.id === 'mappings' && Array.isArray(prop.value) && prop.value.length > 0)
  );
}

// Only what an author can change, so a data refresh or a view switch is not an edit.
function isSameConfig(a: TextPanelSnapshot, b: TextPanelSnapshot): boolean {
  return isEqual([a.options, a.fieldConfig], [b.options, b.fieldConfig]);
}

export function deriveSavedProperties(snapshot: TextPanelSnapshot, baselineContent: string) {
  const { content, options, fieldConfig, ...session } = snapshot;

  return {
    ...session,
    contentChanged: content !== baselineContent,

    mode: options.mode,
    renderMode: options.renderMode ?? defaultOptions.renderMode!,

    // Code mode shows its source verbatim, so Handlebars never runs against it.
    hasHandlebars: options.mode !== TextMode.Code && content.includes('{{'),
    hasMermaid: MERMAID_RE.test(content),
    referencesColor: COLOR_MACRO_RE.test(content),
    hasValueMappings: hasValueMappings(fieldConfig),
    // `satisfies` over a return type: `EventProperty`'s index signature would fail `Exact`.
  } satisfies TextPanelSavedProperties;
}

/**
 * Reports each edited text panel on dashboard save, so the numbers describe what authors chose
 * rather than how often a dashboard is viewed.
 */
export class TextPanelSaveTracker {
  /**
   * `baseline` is the panel as it stood when the dashboard was last saved, kept here rather than in
   * the panel so it survives the editor closing and reopening - which would otherwise make the
   * author's own edit the baseline and lose it. `edited` is unset until the config differs from it.
   */
  private tracked = new Map<number, { baseline: TextPanelSnapshot; edited?: TextPanelSnapshot }>();

  constructor() {
    appEvents?.subscribe?.(DashboardSavedEvent, this.onDashboardSaved);
    appEvents?.subscribe?.(DashboardDiscardedEvent, this.onDashboardDiscarded);
  }

  /** Called on every edit, so the derivation is deferred to save. */
  record(panelId: number, snapshot: TextPanelSnapshot) {
    const entry = this.tracked.get(panelId);

    if (!entry) {
      this.tracked.set(panelId, { baseline: snapshot });
      return;
    }

    // A panel the author left as they found it reports nothing: that leaves the dashboard clean, so
    // no discard event would ever clear it.
    entry.edited = isSameConfig(snapshot, entry.baseline) ? undefined : snapshot;
  }

  private onDashboardSaved = () => {
    for (const { baseline, edited } of this.tracked.values()) {
      if (!edited) {
        continue;
      }

      try {
        TextPanelInteractions.saved(deriveSavedProperties(edited, baseline.content));
      } catch (error) {
        // Reporting must never be able to fail a save.
        console.error('error in text panel tracking handler', error);
      }
    }

    // What was just saved is the new baseline, so an editor left open cannot report again.
    this.tracked.clear();
  };

  // An abandoned config is not what the author chose.
  private onDashboardDiscarded = () => {
    this.tracked.clear();
  };
}

export const textPanelSaveTracker = new TextPanelSaveTracker();
