import { AdHocVariableFilter } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { BreakdownLayoutType } from './Breakdown/types';
import { TrailStepType } from './DataTrailsHistory';
import { ActionViewType } from './shared';

// prettier-ignore
type Interactions = {
  // User selected a label to view its breakdown.
  label_selected: {
    label: string;
    cause: (
      // By clicking the "select" button on that label's breakdown panel
      | 'breakdown_panel'
      // By clicking the label link on the overview
      | 'overview_link'
      // By clicking on the label selector at the top of the breakdown
      | 'selector'
    );
  };
  // User changed a label filter.
  label_filter_changed: {
    label: string;
    action: 'added' | 'removed' | 'changed';
    cause: 'breakdown' | 'adhoc_filter';
  };
  // User changed the breakdown layout
  breakdown_layout_changed: { layout: BreakdownLayoutType };
  // A metric exploration has started due to one of the following causes
  exploration_started: {
    cause: (
      // a bookmark was clicked from the home page
      | 'bookmark_clicked'
      // a recent exploration was clicked from the home page
      | 'recent_clicked'
      // "new exploration" was clicked from the home page
      | 'new_clicked'
      // the page was loaded (or reloaded) from a URL which matches one of the recent explorations
      | 'loaded_local_recent_url'
      // the page was loaded from a URL which did not match one of the recent explorations, and is assumed shared
      | 'loaded_shared_url'
      // the exploration was opened from the dashboard panel menu and is embedded in a drawer
      | 'dashboard_panel'
    );
  };
  // A user has changed a bookmark
  bookmark_changed: {
    action: (
      // Toggled on or off from the bookmark icon
      | 'toggled_on'
      | 'toggled_off'
      // Deleted from the homepage bookmarks list
      | 'deleted'
    );
  };
  // User changes metric explore settings
  settings_changed: { stickyMainGraph?: boolean };
  // User clicks on history nodes to navigate exploration history
  history_step_clicked: {
    type: (
      // One of the standard step types
      | TrailStepType
      // The special metric step type that is created when the user de-selects the current metric
      | 'metric-clear'
    );
    // Which step index was clicked on
    step: number;
    // The total number of steps currently in the trail
    numberOfSteps: number;
  };
  // User clicks on tab to change the action view
  metric_action_view_changed: { view: ActionViewType };
  // User clicks on one of the action buttons associated with a selected metric
  selected_metric_action_clicked: {
    action: (
      // Opens the metric queries in Explore
      | 'open_in_explore'
      // Clicks on the share URL button
      | 'share_url'
      // Deselects the current selected metrics by clicking the "Select new metric" button
      | 'unselect'
      // When in embedded mode, clicked to open the exploration from the embedded view
      | 'open_from_embedded'
    );
  };
  // User selects a metric
  metric_selected: {
    from: (
      // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
      | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics'
    );
    // The number of search terms activated when the selection was made
    searchTermCount: number | null;
  };
  // User opens/closes the prefix filter dropdown
  prefix_filter_clicked: {
    from: (
      // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
      | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics'
    )
    action: (
      // Opens the dropdown
      | 'open'
      // Closes the dropdown
      | 'close'
    )
  };
  wasm_not_supported: {},
};

const PREFIX = 'grafana_explore_metrics_';

export function reportExploreMetrics<E extends keyof Interactions, P extends Interactions[E]>(event: E, payload: P) {
  reportInteraction(`${PREFIX}${event}`, payload);
}

/** Detect the single change in filters and report the event, assuming it came from manipulating the adhoc filter */
export function reportChangeInLabelFilters(newFilters: AdHocVariableFilter[], oldFilters: AdHocVariableFilter[]) {
  if (newFilters.length === oldFilters.length) {
    for (const oldFilter of oldFilters) {
      for (const newFilter of newFilters) {
        if (oldFilter.key === newFilter.key) {
          if (oldFilter.value !== newFilter.value) {
            reportExploreMetrics('label_filter_changed', {
              label: oldFilter.key,
              action: 'changed',
              cause: 'adhoc_filter',
            });
          }
        }
      }
    }
  } else if (newFilters.length < oldFilters.length) {
    for (const oldFilter of oldFilters) {
      let foundOldLabel = false;
      for (const newFilter of newFilters) {
        if (oldFilter.key === newFilter.key) {
          foundOldLabel = true;
          break;
        }
      }
      if (!foundOldLabel) {
        reportExploreMetrics('label_filter_changed', {
          label: oldFilter.key,
          action: 'removed',
          cause: 'adhoc_filter',
        });
      }
    }
  } else {
    for (const newFilter of newFilters) {
      let foundNewLabel = false;
      for (const oldFilter of oldFilters) {
        if (oldFilter.key === newFilter.key) {
          foundNewLabel = true;
          break;
        }
      }
      if (!foundNewLabel) {
        reportExploreMetrics('label_filter_changed', { label: newFilter.key, action: 'added', cause: 'adhoc_filter' });
      }
    }
  }
}
