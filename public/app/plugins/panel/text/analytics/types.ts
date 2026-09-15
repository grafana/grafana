import { type EventProperty } from '@grafana/runtime/unstable';

import { type RenderMode, type TextMode } from '../panelcfg.gen';

/** A literal union, so this file stays free of v2 imports. */
export type TextPanelEditorView = 'write' | 'split' | 'preview';

export interface TextPanelSavedProperties extends EventProperty {
  /** Whether the `text.newFeatures` flag was on, which splits every property below by rollout state. */
  newFeaturesEnabled: boolean;
  /** Whether at least one query returned both fields and rows. No query and an empty result both report false. */
  hasData: boolean;

  /** Which content mode the panel was saved in. */
  mode: TextMode;
  /** Whether the template renders once or once per row. */
  renderMode: RenderMode;

  /** The editor view the author left the panel in. */
  editorViewAtSave: TextPanelEditorView;
  /** Whether the author touched the view toggle, so `editorViewAtSave` tells a choice from an accepted default. */
  editorViewChanged: boolean;

  /** Whether the template uses Handlebars. */
  hasHandlebars: boolean;
  /** Whether the template contains a Mermaid diagram block. Measures demand ahead of the feature itself. */
  hasMermaid: boolean;
  /** Whether the template reads a `.color` macro, which is the only way a threshold reaches the rendered output. */
  referencesColor: boolean;
  /** Whether any value mappings were configured. Unlike thresholds, these reach the output through the normal formatted value, with no macro needed. */
  hasValueMappings: boolean;
}
