import {
  getDataSourceInstanceList,
  locationService,
  onInteraction,
  registerJourneyTriggers,
  onJourneyInstance,
} from '@grafana/runtime';

import { abandonOnRouteChange, collectUnsubs, str } from './utils';

/**
 * Journey: datasource_picker_select
 *
 * User opens the data source picker dropdown and selects a data source. The same picker is used
 * in Explore, the panel query editor, query/ad hoc/group by variable editors, annotation editors
 * and other places, so the journey carries a `surface` attribute. It comes from the URL, or from the
 * picker's `journeySurface` prop where the URL can't tell (e.g. variable editors in the edit pane).
 * Built to measure how long the picker takes to become usable on instances with many (10k+)
 * data sources.
 *
 * Start triggers:
 *   - dashboards_dspicker_opened — user opens the picker dropdown (click, typing or arrow keys). Each open
 *     starts a fresh journey; a still-active one is canceled through the registry's cancelOnRestart.
 *
 * Steps (duration):
 *   - list_render — from opening the dropdown until the list's rows are painted (dashboards_dspicker_list_rendered);
 *     filtered=true when opened by typing, so the list was already narrowed by a search term
 *
 * Events (point-in-time):
 *   - search — user typed a search term (dashboards_dspicker_clicked item=search, debounced; a pending one is sent
 *     before the open ends)
 *   - search — user searched in the advanced modal (dashboards_dspickermodal_clicked item=search)
 *   - config_new_ds — user opened a new tab from an empty search result to configure a data source
 *     (item=config_new_ds_empty_state, in the dropdown or the modal). The picker stays open, so a selection made
 *     right after still ends the journey, but if the new tab stays in front for over 60s the tracker ends it as
 *     abandoned, like any journey in a hidden tab
 *   - open_advanced — user switched to the advanced picker modal (dashboards_dspicker_clicked item=open_advanced_ds_picker)
 *
 * End conditions:
 *   - success: dashboards_dspicker_clicked item=select_ds — a different data source was selected
 *     (the picker also reports this for selections made in the advanced modal it opened, before the modal does)
 *   - success: dashboards_dspicker_cleared — the data source was cleared while the dropdown was open (cleared=true)
 *   - success: dashboards_dspicker_current_reselected — the already selected data source was picked again (changed=false),
 *     in the dropdown or in the advanced modal it opened
 *   - discarded: dashboards_dspicker_dismissed — dropdown closed without a selection (click outside, Escape, Tab out)
 *   - abandoned: dashboards_dspicker_dismissed (reason=unmount) — picker unmounted while open
 *   - abandoned: route pathname changes (e.g. navigating away while the advanced modal is open)
 *   - discarded: dashboards_dspickermodal_clicked item=dismiss — advanced modal closed without a selection
 *   - abandoned: dashboards_dspickermodal_clicked item=config_new_ds — user closed the advanced modal to configure
 *     a new data source
 *   - timeout: 5 min
 *
 * Silent interactions added by this journey (all reported from DataSourcePicker.tsx; each carries the
 * open cycle's `cycle_id`, and events from another cycle are ignored):
 *   - dashboards_dspicker_opened — emitted once per open of the dropdown
 *   - dashboards_dspicker_list_rendered — emitted once when the dropdown list's rows have been painted
 *     (DataSourceList calls back two animation frames after mounting)
 *   - dashboards_dspicker_dismissed — emitted when the dropdown closes or unmounts without a selection
 *   - dashboards_dspicker_current_reselected — emitted when the current data source is picked again
 *   - dashboards_dspicker_cleared — emitted when the data source is cleared while the dropdown is open
 */

const PICKER_EVENT = 'dashboards_dspicker_clicked';
const MODAL_EVENT = 'dashboards_dspickermodal_clicked';

// The trigger sets this right before startJourney, which runs the instance callback synchronously.
// That holds because the trigger and instance are registered together in this module, so the registry
// never has to buffer the handle until an instance callback is registered.
let openingCycleId = '';

// Counting every data source walks the whole list, so it's done once per session rather than on every
// open of the picker. Data sources added later in the session aren't counted.
let totalConfigured: Promise<number> | undefined;
let totalConfiguredCount: number | undefined;
function getTotalConfigured(): Promise<number> {
  if (!totalConfigured) {
    totalConfigured = getDataSourceInstanceList({ all: true }).then((list) => {
      totalConfiguredCount = list.length;
      return list.length;
    });
    totalConfigured.catch(() => {
      totalConfigured = undefined;
    });
  }
  return totalConfigured;
}

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
  if (pathname.startsWith('/dashboard/import')) {
    return 'import';
  }
  if (pathname.startsWith('/d/') || pathname.startsWith('/dashboard/')) {
    return 'dashboard';
  }
  return 'other';
}

registerJourneyTriggers('datasource_picker_select', (tracker) => {
  return onInteraction('dashboards_dspicker_opened', (props) => {
    const { pathname, search } = locationService.getLocation();
    openingCycleId = str(props.cycle_id);
    tracker.startJourney('datasource_picker_select', {
      attributes: {
        // Pickers set `surface` only where the URL can't tell, e.g. variable editors in the edit pane
        surface: str(props.surface) || getPickerSurface(pathname, search),
      },
    });
  });
});

onJourneyInstance('datasource_picker_select', (handle) => {
  const { add, cleanup } = collectUnsubs();
  const cycleId = openingCycleId;
  // Events without a cycle ID (select_ds, modal events) come from the open picker or the modal it opened.
  const isOtherCycle = (props: Record<string, unknown>) => Boolean(props.cycle_id) && props.cycle_id !== cycleId;
  const onCycleInteraction = (name: string, callback: (props: Record<string, unknown>) => void) =>
    onInteraction(name, (props) => {
      if (!isOtherCycle(props)) {
        callback(props);
      }
    });

  // Attributes can't be set once the journey has ended, so the count also goes on the end attributes
  // when it's already known. It may still be loading when the user selects quickly on the first open.
  const end = (outcome: Parameters<typeof handle.end>[0], attributes: Record<string, string> = {}) => {
    const all =
      totalConfiguredCount === undefined
        ? attributes
        : { ...attributes, totalConfigured: String(totalConfiguredCount) };
    if (Object.keys(all).length > 0) {
      handle.end(outcome, all);
    } else {
      handle.end(outcome);
    }
  };

  const listRender = handle.startStep('list_render');
  const startPathname = locationService.getLocation().pathname;
  add(abandonOnRouteChange(handle, (pathname) => pathname === startPathname));
  // A selection in the advanced modal is reported by both the modal and the picker it was opened from.
  let selectedIn = 'dropdown';

  add(
    onCycleInteraction('dashboards_dspicker_list_rendered', (props) => {
      // Opening by typing mounts an already filtered list, so it doesn't measure rendering the full list
      listRender.end({ totalListed: str(props.total_listed), filtered: props.searched ? 'true' : 'false' });
      // Counted after list_render ends so the lookup doesn't add to the measured time. This is every
      // configured data source, not only those the picker's filters allow.
      getTotalConfigured()
        .then((count) => handle.setAttributes({ totalConfigured: String(count) }))
        .catch(() => {});
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
          end('success', { dsType: str(props.ds_type), changed: 'true', selectedIn });
          break;
        // The empty-state link opens a new tab and leaves the dropdown open, so the user may still select.
        // A long stay in the new tab ends the journey as abandoned through the tracker's hidden-tab rule.
        case 'config_new_ds_empty_state':
          handle.recordEvent('config_new_ds');
          break;
      }
    })
  );

  add(
    onInteraction(MODAL_EVENT, (props) => {
      // The modal is also opened on its own (e.g. from the query editor); only the picker's counts here
      if (props.src !== 'ds_picker') {
        return;
      }
      switch (props.item) {
        case 'search':
          handle.recordEvent('search');
          break;
        case 'dismiss':
          end('discarded');
          break;
        // This button also closes the modal; the empty-state link leaves it open
        case 'config_new_ds':
          end('abandoned', { reason: 'config_new_ds' });
          break;
        case 'config_new_ds_empty_state':
          handle.recordEvent('config_new_ds');
          break;
      }
    })
  );

  add(
    onCycleInteraction('dashboards_dspicker_current_reselected', (props) => {
      end('success', { dsType: str(props.ds_type), changed: 'false', selectedIn });
    })
  );

  add(
    onCycleInteraction('dashboards_dspicker_cleared', () => {
      end('success', { changed: 'true', cleared: 'true', selectedIn });
    })
  );

  add(
    onCycleInteraction('dashboards_dspicker_dismissed', (props) => {
      if (props.reason === 'unmount') {
        end('abandoned', { reason: 'unmount' });
      } else {
        end('discarded');
      }
    })
  );

  return cleanup;
});
