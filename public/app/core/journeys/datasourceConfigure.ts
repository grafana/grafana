import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: datasource_configure
 *
 * User adds and configures a new datasource until a successful connection test.
 *
 * Start triggers:
 *   - connections_datasource_list_add_datasource_clicked — user clicks "Add new data source" on the list page
 *   - connections_new_datasource_page_view — new datasource page viewed with no active journey (direct navigation)
 *   - grafana_ds_add_datasource_clicked — user picks a plugin type from the catalog with no active journey
 *
 * Steps:
 *   - select_type — user picks a datasource plugin from the catalog (grafana_ds_add_datasource_clicked)
 *   - save_config — user saves datasource settings (connections_datasources_ds_configured)
 *   - test_failed — user runs a connection test that fails; repeatable (grafana_ds_test_datasource_clicked with success=false)
 *
 * End conditions:
 *   - success: grafana_ds_test_datasource_clicked — connection test passed (success=true)
 *   - discarded: connections_new_datasource_cancelled — user clicks Cancel on the new datasource page
 *   - discarded: connections_datasource_deleted — user deletes the datasource before completing setup
 *   - abandoned: connections_datasource_config_page_left — user navigates away from the config page without testing
 *   - timeout: 1 hour — no end condition fires (generous to account for reading docs mid-setup)
 *
 * Silent interactions added by this journey:
 *   - connections_new_datasource_cancelled — emitted in NewDataSource.tsx on Cancel click
 *   - connections_datasource_deleted — emitted in datasources/state/hooks.ts on delete confirm
 *   - connections_datasource_config_page_left — emitted in EditDataSource.tsx on component unmount
 */

registerJourneyTriggers('datasource_configure', (tracker) => {
  const { add, cleanup } = collectUnsubs();

  // "Add new data source" button on the datasource list page
  add(onInteraction('connections_datasource_list_add_datasource_clicked', () => {
    tracker.startJourney('datasource_configure', {
      attributes: { source: 'datasource_list' },
    });
  }));

  // New datasource page opened directly (e.g. from advanced datasource picker link)
  add(onInteraction('connections_new_datasource_page_view', () => {
    if (!tracker.getActiveJourney('datasource_configure')) {
      tracker.startJourney('datasource_configure', {
        attributes: { source: 'datasource_picker' },
      });
    }
  }));

  // Picking a type from the catalog - starts journey if not already active
  add(onInteraction('grafana_ds_add_datasource_clicked', (props) => {
    const existing = tracker.getActiveJourney('datasource_configure');
    if (existing) {
      existing.recordEvent('select_type', {
        pluginId: str(props.plugin_id),
      });
      existing.setAttributes({
        pluginId: str(props.plugin_id),
      });
    } else {
      tracker.startJourney('datasource_configure', {
        attributes: {
          source: 'catalog',
          pluginId: str(props.plugin_id),
        },
      });
    }
  }));

  return cleanup;
});

onJourneyInstance('datasource_configure', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // User saved datasource config
  add(onInteraction('connections_datasources_ds_configured', () => {
    handle.recordEvent('save_config');
  }));

  // User tested datasource connection
  add(onInteraction('grafana_ds_test_datasource_clicked', (props) => {
    const success = props.success === true || props.success === 'true';

    if (success) {
      handle.end('success');
    } else {
      handle.recordEvent('test_failed');
    }
  }));

  // User clicked Cancel on the new datasource page
  add(onInteraction('connections_new_datasource_cancelled', () => {
    handle.end('discarded');
  }));

  // User deleted the datasource instead of completing setup
  add(onInteraction('connections_datasource_deleted', () => {
    handle.end('discarded');
  }));

  // User navigated away from config page without completing test
  add(onInteraction('connections_datasource_config_page_left', () => {
    handle.end('abandoned');
  }));

  return cleanup;
});
