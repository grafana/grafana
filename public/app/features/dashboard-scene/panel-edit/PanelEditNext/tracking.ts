import { debounce } from 'lodash';

import { CoreApp } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { QueryEditorType } from './constants';

/**
 * Single event name for all v2 panel-edit interactions that don't already
 * have an established v1 event.  Discriminated by `action` + `item_type`.
 */
const EVENT_PANEL_EDIT_NEXT = 'grafana_panel_edit_next_interaction';

type QueryEditorVersion = 'classic' | 'next';

/**
 * For events both query editors send. `editor` says which one sent it (default: next).
 * The classic editor's components also run in Explore, alerting and notebooks. There they pass `silent`, so
 * journeys still see the event but analytics don't count it as a panel edit.
 */
export interface QueryEditorTrackingOptions {
  editor?: QueryEditorVersion;
  silent?: boolean;
}

export function isPanelEditorApp(app?: CoreApp): boolean {
  // The classic query editor defaults to the panel editor when no app is given.
  return (app ?? CoreApp.PanelEditor) === CoreApp.PanelEditor;
}

function reportQueryEditorInteraction(properties: Record<string, unknown>, options: QueryEditorTrackingOptions = {}) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    { ...properties, editor: options.editor ?? 'next' },
    options.silent ? { silent: true } : undefined
  );
}

// Reports that a search happened, never what was typed.
export const trackTransformationSearch = debounce((query: string) => {
  if (query) {
    reportInteraction(EVENT_PANEL_EDIT_NEXT, {
      action: 'search_transformations',
    });
  }
}, 300);

export function trackTransformationFilterChanged(filter: string | null) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'filter_transformations',
    filter: filter ?? 'view_all',
  });
}

export type AddCardSource = 'section_header' | 'inline' | 'empty_state' | 'legacy' | 'stacked_gap';

export function trackAddQuery(
  querySource: 'saved_query' | 'new_query',
  cardSource: AddCardSource,
  options?: QueryEditorTrackingOptions
) {
  reportQueryEditorInteraction({ action: 'add_query', source: querySource, card_source: cardSource }, options);
}

export function trackOpenSavedQueryPicker(source: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'open_saved_query_picker',
    source,
  });
}

export function trackAddExpressionInitiated(source: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_expression_initiated',
    source,
  });
}

export function trackAddTransformationInitiated(source: AddCardSource, options?: { silent?: boolean }) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action: 'add_transformation_initiated',
      source,
    },
    options
  );
}

export type CardActionSource = 'content_header' | 'stacked_header' | 'sidebar_card';

export function trackCardAction(
  action: 'delete' | 'toggle_hide' | 'duplicate',
  itemType: QueryEditorType,
  source: CardActionSource,
  options?: QueryEditorTrackingOptions
) {
  reportQueryEditorInteraction({ action, item_type: itemType, source }, options);
}

export function trackTransformationToolAction(
  action: 'toggle_help' | 'toggle_filter' | 'toggle_debug',
  source?: CardActionSource
) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: QueryEditorType.Transformation,
    ...(source && { source }),
  });
}

export function trackQueryMenuAction(
  action: 'duplicate' | 'toggle_datasource_help' | 'open_inspector',
  itemType: QueryEditorType,
  source?: CardActionSource
) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: itemType,
    ...(source && { source }),
  });
}

export function trackReorder(itemType: 'query' | 'transformation', options?: QueryEditorTrackingOptions) {
  reportQueryEditorInteraction({ action: 'reorder', item_type: itemType }, options);
}

export function trackEditorVersionToggle(direction: 'upgrade' | 'downgrade') {
  const payload: Record<string, string> = {
    action: 'toggle_editor_version',
    direction,
    'paneledit.buttonLabels': String(getFeatureFlagClient().getBooleanValue(FlagKeys.PaneleditButtonLabels, false)),
  };
  faro.api.pushEvent(EVENT_PANEL_EDIT_NEXT, payload);
  reportInteraction(EVENT_PANEL_EDIT_NEXT, payload);
}

export function trackSidebarSizeToggle(direction: 'expand' | 'collapse') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_sidebar_size',
    direction,
  });
}

export function trackSidebarViewChange(view: string, options?: QueryEditorTrackingOptions) {
  reportQueryEditorInteraction({ action: 'change_sidebar_view', view }, options);
}

export function trackStackedViewToggle(direction: 'enter' | 'exit') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_stacked_view',
    direction,
  });
}

export function trackQueryOptionsToggle(open: boolean, options?: QueryEditorTrackingOptions) {
  reportQueryEditorInteraction({ action: 'toggle_query_options', open }, options);
}

export function trackMultiSelectToggle(direction: 'enter' | 'exit') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_multi_select',
    direction,
  });
}

export function trackRenameInitiated() {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'rename_initiated',
    item_type: QueryEditorType.Query,
  });
}
