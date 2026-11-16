import { locationService, onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: datasource_picker_select
 *
 * User opens the data source picker dropdown and selects a data source. The same picker is used
 * in Explore, the panel query editor, query/ad hoc/group by variable editors, annotation editors
 * and other places, so the journey carries a `surface` attribute derived from the current URL.
 * Built to measure how long the picker takes to become usable on instances with many (10k+)
 * data sources.
 *
 * Start triggers:
 *   - dashboards_dspicker_clicked (item=open_dspicker) — user opens the picker dropdown
 *
 * Steps (duration):
 *   - list_render — from opening the dropdown until the list is rendered (dashboards_dspicker_list_rendered)
 *
 * Events (point-in-time):
 *   - search — user typed a search term (dashboards_dspicker_clicked item=search, debounced)
 *   - open_advanced — user switched to the advanced picker modal (dashboards_dspicker_clicked item=open_advanced_ds_picker)
 *
 * End conditions:
 *   - success: dashboards_dspicker_clicked item=select_ds — a different data source was selected
 *     (the picker also reports this for selections made in the advanced modal it opened)
 *   - success: dashboards_dspickermodal_clicked item=select_ds — selected in the advanced modal
 *   - success: dashboards_dspicker_current_reselected — the already selected data source was picked again (changed=false)
 *   - discarded: dashboards_dspicker_dismissed — dropdown closed without a selection (click outside, Escape, Tab out)
 *   - discarded: dashboards_dspickermodal_clicked item=dismiss — advanced modal closed without a selection
 *   - abandoned: dashboards_dspickermodal_clicked item=config_new_ds — user left to configure a new data source
 *   - timeout: 5 min
 *
 * Silent interactions added by this journey (all in DataSourcePicker.tsx):
 *   - dashboards_dspicker_list_rendered — emitted once when the dropdown list has mounted
 *   - dashboards_dspicker_dismissed — emitted when the user closes the dropdown without selecting
 *   - dashboards_dspicker_current_reselected — emitted when the current data source is picked again
 */

const PICKER_EVENT = 'dashboards_dspicker_clicked';
const MODAL_EVENT = 'dashboards_dspickermodal_clicked';

export function getPickerSurface(pathname: string, search: string): string {
  const params = new URLSearchParams(search);

  if (pathname.startsWith('/explore')) {
    return 'explore';
  }
  if (pathname.startsWith('/alerting')) {
    return 'alerting';
  }
  if (params.has('editPanel')) {
    return 'panel_edit';
  }
  const editview = params.get('editview');
  if (editview?.startsWith('variables')) {
    return 'variable_editor';
  }
  if (editview?.startsWith('annotations')) {
    return 'annotation_editor';
  }
  if (pathname.startsWith('/d/') || pathname.startsWith('/dashboard/')) {
    return 'dashboard';
  }
  return 'other';
}

registerJourneyTriggers('datasource_picker_select', (tracker) => {
  return onInteraction(PICKER_EVENT, (props) => {
    if (props.item !== 'open_dspicker') {
      return;
    }
    if (!tracker.getActiveJourney('datasource_picker_select')) {
      const { pathname, search } = locationService.getLocation();
      tracker.startJourney('datasource_picker_select', {
        attributes: {
          surface: getPickerSurface(pathname, search),
          totalConfigured: str(props.total_configured),
        },
      });
    }
  });
});

onJourneyInstance('datasource_picker_select', (handle) => {
  const { add, cleanup } = collectUnsubs();

  const listRender = handle.startStep('list_render');
  // A selection in the advanced modal is reported by both the modal and the picker it was opened from.
  let selectedIn = 'dropdown';

  add(
    onInteraction('dashboards_dspicker_list_rendered', (props) => {
      listRender.end({ totalListed: str(props.total_listed) });
    })
  );

  add(
    onInteraction(PICKER_EVENT, (props) => {
      switch (props.item) {
        case 'search':
          handle.recordEvent('search');
          break;
        case 'open_advanced_ds_picker':
          selectedIn = 'modal';
          handle.recordEvent('open_advanced');
          break;
        case 'select_ds':
          handle.end('success', { dsType: str(props.ds_type), changed: 'true', selectedIn });
          break;
      }
    })
  );

  add(
    onInteraction(MODAL_EVENT, (props) => {
      if (props.item === 'select_ds') {
        handle.end('success', { dsType: str(props.ds_type), changed: 'true', selectedIn: 'modal' });
      } else if (props.item === 'dismiss') {
        handle.end('discarded');
      } else if (props.item === 'config_new_ds') {
        handle.end('abandoned', { reason: 'config_new_ds' });
      }
    })
  );

  add(
    onInteraction('dashboards_dspicker_current_reselected', (props) => {
      handle.end('success', { dsType: str(props.ds_type), changed: 'false', selectedIn });
    })
  );

  add(
    onInteraction('dashboards_dspicker_dismissed', () => {
      handle.end('discarded');
    })
  );

  return cleanup;
});
