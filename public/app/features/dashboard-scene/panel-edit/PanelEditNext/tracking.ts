import { debounce } from 'lodash';

import { reportInteraction } from '@grafana/runtime';

import { QueryEditorType } from './constants';

/**
 * Single event name for all v2 panel-edit interactions that don't already
 * have an established v1 event.  Discriminated by `action` + `item_type`.
 */
const EVENT_PANEL_EDIT_NEXT = 'grafana_panel_edit_next_interaction';

// ---------------------------------------------------------------------------
// Transformation picker
// ---------------------------------------------------------------------------

export const trackTransformationSearch = debounce((query: string, resultCount: number) => {
  if (query) {
    reportInteraction(EVENT_PANEL_EDIT_NEXT, {
      action: 'search_transformations',
      query,
      result_count: resultCount,
    });
  }
}, 300);

export function trackTransformationFilterChanged(filter: string | null) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'filter_transformations',
    filter: filter ?? 'view_all',
  });
}

// ---------------------------------------------------------------------------
// Add card buttons (sidebar)
// ---------------------------------------------------------------------------

type AddCardSource = 'section_header' | 'inline';

export function trackAddQuery(querySource: 'saved_query' | 'new_query', cardSource: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_query',
    source: querySource,
    card_source: cardSource,
  });
}

export function trackAddExpressionInitiated(source: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_expression_initiated',
    source,
  });
}

export function trackAddTransformationInitiated(source: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_transformation_initiated',
    source,
  });
}

// ---------------------------------------------------------------------------
// Card management actions (delete / hide / duplicate)
// ---------------------------------------------------------------------------

export function trackCardAction(action: 'delete' | 'toggle_hide' | 'duplicate', itemType: QueryEditorType) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: itemType,
  });
}

// ---------------------------------------------------------------------------
// Transformation toolbar buttons
// ---------------------------------------------------------------------------

export function trackTransformationToolAction(action: 'toggle_help' | 'toggle_filter' | 'toggle_debug') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: QueryEditorType.Transformation,
  });
}

// ---------------------------------------------------------------------------
// Query actions menu
// ---------------------------------------------------------------------------

export function trackQueryMenuAction(action: 'duplicate' | 'toggle_datasource_help' | 'open_inspector') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: QueryEditorType.Query,
  });
}

// ---------------------------------------------------------------------------
// Drag-and-drop reorder
// ---------------------------------------------------------------------------

export function trackReorder(itemType: 'query' | 'transformation') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'reorder',
    item_type: itemType,
  });
}

// ---------------------------------------------------------------------------
// Editor version banner
// ---------------------------------------------------------------------------

export function trackEditorVersionToggle(direction: 'upgrade' | 'downgrade') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_editor_version',
    direction,
  });
}

export function trackBannerDismiss() {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'dismiss_version_banner',
  });
}

export function trackFeedbackClick() {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'click_feedback_link',
  });
}
