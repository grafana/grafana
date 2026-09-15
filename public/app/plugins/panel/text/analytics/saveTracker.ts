import { isEqual } from 'lodash';

import { type FieldConfigSource } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';
import { DashboardDiscardedEvent, DashboardSavedEvent } from 'app/types/events';

import { defaultOptions, type Options, TextMode } from '../panelcfg.gen';

import { TextPanelInteractions } from './main';
import { type TextPanelEditorView, type TextPanelSavedProperties } from './types';

export interface TextPanelSnapshot {
  /** Resolved template, with the panel defaults already applied. */
  content: string;
  options: Options;
  fieldConfig: FieldConfigSource;
  newFeaturesEnabled: boolean;
  hasData: boolean;
  editorViewAtSave: TextPanelEditorView;
  editorViewChanged: boolean;
}

const MERMAID_RE = /```[ \t]*mermaid\b|class=["'][^"']*\bmermaid\b/i;

const COLOR_MACRO_RE = /\$\{__[^}]*\.color\b/;

function hasValueMappings(fieldConfig: FieldConfigSource): boolean {
  if ((fieldConfig.defaults.mappings?.length ?? 0) > 0) {
    return true;
  }

  return fieldConfig.overrides.some((override) =>
    override.properties.some((prop) => prop.id === 'mappings' && Array.isArray(prop.value) && prop.value.length > 0)
  );
}

/** Only what an author can change, so a data refresh or a view switch is not an edit. */
type PanelConfig = Pick<TextPanelSnapshot, 'options' | 'fieldConfig'>;

function isSameConfig(a: PanelConfig, b: PanelConfig): boolean {
  return isEqual([a.options, a.fieldConfig], [b.options, b.fieldConfig]);
}

// Not the scene's uid: saveCompleted rewrites that before the save event fires.
function currentDashboard(): string {
  const { pathname } = locationService.getLocation();
  return pathname.match(/\/d\/([^/]+)/)?.[1] ?? pathname;
}

export function deriveSavedProperties(snapshot: TextPanelSnapshot) {
  const { content, options, fieldConfig, ...session } = snapshot;

  return {
    ...session,

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

/** Reports each text panel the author changed, on dashboard save rather than on view. */
export class TextPanelSaveTracker {
  /** The baseline lives here, not in the panel, so it survives the editor reopening. */
  private tracked = new Map<number, { baseline: PanelConfig; edited?: TextPanelSnapshot }>();
  private dashboard: string | undefined;

  constructor() {
    appEvents?.subscribe?.(DashboardSavedEvent, this.onDashboardSaved);
    appEvents?.subscribe?.(DashboardDiscardedEvent, this.onDashboardDiscarded);
  }

  record(panelId: number, snapshot: TextPanelSnapshot) {
    const dashboard = currentDashboard();

    if (dashboard !== this.dashboard) {
      this.dashboard = dashboard;
      this.tracked.clear();
    }

    const entry = this.tracked.get(panelId);

    if (!entry) {
      this.tracked.set(panelId, { baseline: snapshot });
      return;
    }

    entry.edited = isSameConfig(snapshot, entry.baseline) ? undefined : snapshot;
  }

  /** Called when a panel edit is discarded, which publishes no dashboard-level event. */
  forget(panelId: number) {
    this.tracked.delete(panelId);
  }

  private onDashboardSaved = () => {
    if (this.dashboard !== currentDashboard()) {
      this.tracked.clear();
      return;
    }

    for (const entry of this.tracked.values()) {
      if (!entry.edited) {
        continue;
      }

      try {
        TextPanelInteractions.saved(deriveSavedProperties(entry.edited));
      } catch (error) {
        // Reporting must never be able to fail a save.
        console.error('error in text panel tracking handler', error);
      }

      entry.baseline = entry.edited;
      entry.edited = undefined;
    }
  };

  private onDashboardDiscarded = () => {
    this.tracked.clear();
  };
}

export const textPanelSaveTracker = new TextPanelSaveTracker();
