import { isEqual } from 'lodash';
import React, { useState, useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { firstValueFrom } from 'rxjs';

import { AppEvents, PanelData, SelectableValue, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { getPanelDataFrames } from '../dashboard/components/HelpWizard/utils';
import { getPanelInspectorStyles2 } from '../inspector/styles';
import { reportPanelInspectInteraction } from '../search/page/reporting';

import { InspectTab } from './types';

enum ShowContent {
  PanelJSON = 'panel',
  PanelData = 'data',
  DataFrames = 'frames',
}

const options: Array<SelectableValue<ShowContent>> = [
  {
    label: t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
    description: t(
      'dashboard.inspect-json.panel-json-description',
      'The model saved in the dashboard JSON that configures how everything works.'
    ),
    value: ShowContent.PanelJSON,
  },
  {
    label: t('dashboard.inspect-json.panel-data-label', 'Panel data'),
    description: t('dashboard.inspect-json.panel-data-description', 'The raw model passed to the panel visualization'),
    value: ShowContent.PanelData,
  },
  {
    label: t('dashboard.inspect-json.dataframe-label', 'DataFrame JSON (from Query)'),
    description: t(
      'dashboard.inspect-json.dataframe-description',
      'Raw data without transformations and field config applied. '
    ),
    value: ShowContent.DataFrames,
  },
];

interface Props {
  onClose: () => void;
  dashboard?: DashboardModel;
  panel?: PanelModel;
  data?: PanelData;
}

export function InspectJSONTab({ panel, dashboard, data, onClose }: Props) {
  const styles = useStyles2(getPanelInspectorStyles2);
  const jsonOptions = useMemo(() => {
    if (panel) {
      if (panel.plugin?.meta.skipDataQuery) {
        return [options[0]];
      }
      return options;
    }
    return options.slice(1, options.length);
  }, [panel]);
  const [show, setShow] = useState(panel ? ShowContent.PanelJSON : ShowContent.DataFrames);
  const [text, setText] = useState('');

  useAsync(async () => {
    const v = await getJSONObject(show, panel, data);
    setText(getPrettyJSON(v));
  }, [show, panel, data]);

  const onApplyPanelModel = useCallback(() => {
    if (panel && dashboard && text) {
      try {
        if (!dashboard!.meta.canEdit) {
          appEvents.emit(AppEvents.alertError, ['Unable to apply']);
        } else {
          const updates = JSON.parse(text);
          dashboard!.shouldUpdateDashboardPanelFromJSON(updates, panel!);

          //Report relevant updates
          reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
            panel_type_changed: panel!.type !== updates.type,
            panel_id_changed: panel!.id !== updates.id,
            panel_grid_pos_changed: !isEqual(panel!.gridPos, updates.gridPos),
            panel_targets_changed: !isEqual(panel!.targets, updates.targets),
          });

          panel!.restoreModel(updates);
          panel!.refresh();
          appEvents.emit(AppEvents.alertSuccess, ['Panel model updated']);
        }
      } catch (err) {
        console.error('Error applying updates', err);
        appEvents.emit(AppEvents.alertError, ['Invalid JSON text']);
      }

      onClose();
    }
  }, [panel, dashboard, onClose, text]);

  const onShowHelpWizard = useCallback(() => {
    reportPanelInspectInteraction(InspectTab.JSON, 'supportWizard');
    const queryParms = locationService.getSearch();
    queryParms.set('inspectTab', InspectTab.Help.toString());
    locationService.push('?' + queryParms.toString());
  }, []);

  const isPanelJSON = show === ShowContent.PanelJSON;
  const canEdit = dashboard && dashboard.meta.canEdit;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} aria-label={selectors.components.PanelInspector.Json.content}>
        <Field label={t('dashboard.inspect-json.select-source', 'Select source')} className="flex-grow-1">
          <Select
            inputId="select-source-dropdown"
            options={jsonOptions}
            value={jsonOptions.find((v) => v.value === show) ?? jsonOptions[0].value}
            onChange={(v) => setShow(v.value!)}
          />
        </Field>
        {panel && isPanelJSON && canEdit && (
          <Button className={styles.toolbarItem} onClick={onApplyPanelModel}>
            Apply
          </Button>
        )}
        {show === ShowContent.DataFrames && (
          <Button className={styles.toolbarItem} onClick={onShowHelpWizard}>
            Support
          </Button>
        )}
      </div>

      <div className={styles.content}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <CodeEditor
              width="100%"
              height={height}
              language="json"
              showLineNumbers={true}
              showMiniMap={(text && text.length) > 100}
              value={text || ''}
              readOnly={!isPanelJSON}
              onBlur={setText}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

async function getJSONObject(show: ShowContent, panel?: PanelModel, data?: PanelData) {
  if (show === ShowContent.PanelData) {
    reportPanelInspectInteraction(InspectTab.JSON, 'panelData');
    return data;
  }

  if (show === ShowContent.DataFrames) {
    reportPanelInspectInteraction(InspectTab.JSON, 'dataFrame');

    let d = data;

    // do not include transforms and
    if (panel && data?.state === LoadingState.Done) {
      d = await firstValueFrom(
        panel.getQueryRunner().getData({
          withFieldConfig: false,
          withTransforms: false,
        })
      );
    }
    return getPanelDataFrames(d);
  }

  if (show === ShowContent.PanelJSON && panel) {
    reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');
    return panel!.getSaveModel();
  }

  return { note: t('dashboard.inspect-json.unknown', 'Unknown Object: {{show}}', { show }) };
}

function getPrettyJSON(obj: any): string {
  let r = '';
  try {
    r = JSON.stringify(obj, getCircularReplacer(), 2);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.toString().includes('RangeError') || e.toString().includes('allocation size overflow'))
    ) {
      appEvents.emit(AppEvents.alertError, [e.toString(), 'Cannot display JSON, the object is too big.']);
    } else {
      appEvents.emit(AppEvents.alertError, [e instanceof Error ? e.toString() : e]);
    }
  }
  return r;
}

function getCircularReplacer() {
  const seen = new WeakSet();

  return (key: string, value: unknown) => {
    if (key === '__dataContext') {
      return 'Filtered out in JSON serialization';
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}
