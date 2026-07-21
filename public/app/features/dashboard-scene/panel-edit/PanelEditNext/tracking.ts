import { debounce } from 'lodash';

import { getAppEvents, reportInteraction } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { PanelEditNextFeedbackEvent } from 'app/types/events';

import { QueryEditorType } from './constants';

/**
 * Single event name for all v2 panel-edit interactions that don't already
 * have an established v1 event.  Discriminated by `action` + `item_type`.
 */
const EVENT_PANEL_EDIT_NEXT = 'grafana_panel_edit_next_interaction';

export const trackTransformationSearch = debounce((query: string) => {
  if (query) {
    reportInteraction(EVENT_PANEL_EDIT_NEXT, {
      action: 'search_transformations',
      query,
    });
  }
}, 300);

export function trackTransformationFilterChanged(filter: string | null) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'filter_transformations',
    filter: filter ?? 'view_all',
  });
}

type AddCardSource = 'section_header' | 'inline' | 'empty_state' | 'legacy';

export function trackAddQuery(
  querySource: 'saved_query' | 'new_query',
  cardSource: AddCardSource,
  options?: { silent?: boolean }
) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action: 'add_query',
      source: querySource,
      card_source: cardSource,
    },
    options
  );
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

export type CardActionSource = 'content_header' | 'sidebar_card';

export function trackCardAction(
  action: 'delete' | 'toggle_hide' | 'duplicate',
  itemType: QueryEditorType,
  source: CardActionSource,
  options?: { silent?: boolean }
) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action,
      item_type: itemType,
      source,
    },
    options
  );
}

export function trackTransformationToolAction(action: 'toggle_help' | 'toggle_filter' | 'toggle_debug') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: QueryEditorType.Transformation,
  });
}

export function trackQueryMenuAction(
  action: 'duplicate' | 'toggle_datasource_help' | 'open_inspector',
  itemType: QueryEditorType
) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: itemType,
  });
}

export function trackReorder(itemType: 'query' | 'transformation', options?: { silent?: boolean }) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action: 'reorder',
      item_type: itemType,
    },
    options
  );
}

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

export function trackSidebarSizeToggle(direction: 'expand' | 'collapse') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_sidebar_size',
    direction,
  });
}

export function trackSidebarViewChange(view: string, options?: { silent?: boolean }) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action: 'change_sidebar_view',
      view,
    },
    options
  );
}

export function trackStackedViewToggle(direction: 'enter' | 'exit') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_stacked_view',
    direction,
  });
}

export function trackQueryOptionsToggle(open: boolean, options?: { silent?: boolean }) {
  reportInteraction(
    EVENT_PANEL_EDIT_NEXT,
    {
      action: 'toggle_query_options',
      open,
    },
    options
  );
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

export function startFeedbackSurvey(): void {
  const isPanelEditNextFeedbackEventEnabled = getFeatureFlagClient().getBooleanValue(
    FlagKeys.GrafanaPanelEditNextFeedbackEvent,
    false
  );
  if (isPanelEditNextFeedbackEventEnabled) {
    // Fire an event for grafana-setupguide-app to detect, which will show the survey in Cloud.
    getAppEvents().publish(new PanelEditNextFeedbackEvent());
    return;
  }
}
