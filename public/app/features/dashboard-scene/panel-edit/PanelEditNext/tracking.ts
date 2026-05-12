import { debounce } from 'lodash';

import { reportInteraction } from '@grafana/runtime';

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

type AddCardSource = 'section_header' | 'inline';

export function trackAddQuery(querySource: 'saved_query' | 'new_query', cardSource: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_query',
    source: querySource,
    card_source: cardSource,
  });
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

export function trackAddTransformationInitiated(source: AddCardSource) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'add_transformation_initiated',
    source,
  });
}

export type CardActionSource = 'content_header' | 'sidebar_card';

export function trackCardAction(
  action: 'delete' | 'toggle_hide' | 'duplicate',
  itemType: QueryEditorType,
  source: CardActionSource
) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action,
    item_type: itemType,
    source,
  });
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

export function trackReorder(itemType: 'query' | 'transformation') {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'reorder',
    item_type: itemType,
  });
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

export function trackSidebarViewChange(view: QueryEditorType) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'change_sidebar_view',
    view,
  });
}

export function trackQueryOptionsToggle(open: boolean) {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'toggle_query_options',
    open,
  });
}

export function trackSelectButtonClick() {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'click_multi_select',
  });
}

export function trackRenameInitiated() {
  reportInteraction(EVENT_PANEL_EDIT_NEXT, {
    action: 'rename_initiated',
    item_type: QueryEditorType.Query,
  });
}

const INTERCOM_APP_ID = 'agpb1wfw';
const INTERCOM_SURVEY_ID = '59003702';

function getIntercom(): ((command: string, ...args: unknown[]) => void) | undefined {
  if ('Intercom' in window && typeof window.Intercom === 'function') {
    return window.Intercom;
  }
  return undefined;
}

let intercomLoadPromise: Promise<void> | null = null;

function ensureIntercomLoaded(): Promise<void> {
  if (typeof getIntercom() === 'function') {
    return Promise.resolve();
  }

  if (intercomLoadPromise) {
    return intercomLoadPromise;
  }

  intercomLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://widget.intercom.io/widget/${INTERCOM_APP_ID}`;
    script.async = true;
    script.onload = () => {
      getIntercom()?.('boot', { app_id: INTERCOM_APP_ID, hide_default_launcher: true });
      resolve();
    };
    script.onerror = () => {
      intercomLoadPromise = null;
      reject(new Error('Failed to load Intercom'));
    };
    document.head.appendChild(script);
  });

  return intercomLoadPromise;
}

export function startIntercomSurvey(): void {
  ensureIntercomLoaded()
    .then(() => {
      getIntercom()?.('startSurvey', INTERCOM_SURVEY_ID);
    })
    .catch(() => {
      // Intercom blocked or unavailable — silently ignore.
      // The survey is non-critical; the editor remains fully functional.
    });
}
