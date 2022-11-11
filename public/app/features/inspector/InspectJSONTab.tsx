import { isEqual } from 'lodash';
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { firstValueFrom } from 'rxjs';

import { AppEvents, PanelData, SelectableValue, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, CodeEditor, Field, Select } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { t } from 'app/core/internationalization';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { getPanelDataFrames } from '../dashboard/components/HelpWizard/utils';
import { getPanelInspectorStyles } from '../inspector/styles';
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

interface State {
  show: ShowContent;
  text: string;
}

export class InspectJSONTab extends PureComponent<Props, State> {
  hasPanelJSON: boolean;

  constructor(props: Props) {
    super(props);
    this.hasPanelJSON = !!(props.panel && props.dashboard);
    // If we are in panel, we want to show PanelJSON, otherwise show DataFrames
    this.state = {
      show: this.hasPanelJSON ? ShowContent.PanelJSON : ShowContent.DataFrames,
      text: this.hasPanelJSON ? getPrettyJSON(props.panel!.getSaveModel()) : getPrettyJSON(props.data),
    };
  }

  componentDidMount() {
    // when opening the inspector we want to report the interaction
    reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');
  }

  onSelectChanged = async (item: SelectableValue<ShowContent>) => {
    const show = await this.getJSONObject(item.value!);
    const text = getPrettyJSON(show);
    this.setState({ text, show: item.value! });
  };

  // Called onBlur
  onTextChanged = (text: string) => {
    this.setState({ text });
  };

  async getJSONObject(show: ShowContent) {
    const { data, panel } = this.props;
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

    if (this.hasPanelJSON && show === ShowContent.PanelJSON) {
      reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');
      return panel!.getSaveModel();
    }

    return { note: t('dashboard.inspect-json.unknown', 'Unknown Object: {{show}}', { show }) };
  }

  onApplyPanelModel = () => {
    const { panel, dashboard, onClose } = this.props;
    if (this.hasPanelJSON) {
      try {
        if (!dashboard!.meta.canEdit) {
          appEvents.emit(AppEvents.alertError, ['Unable to apply']);
        } else {
          const updates = JSON.parse(this.state.text);
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
  };

  onShowHelpWizard = () => {
    reportPanelInspectInteraction(InspectTab.JSON, 'supportWizard');
    const queryParms = locationService.getSearch();
    queryParms.set('inspectTab', InspectTab.Help.toString());
    locationService.push('?' + queryParms.toString());
  };

  render() {
    const { dashboard } = this.props;
    const { show, text } = this.state;
    const jsonOptions = this.hasPanelJSON ? options : options.slice(1, options.length);
    const selected = options.find((v) => v.value === show);
    const isPanelJSON = show === ShowContent.PanelJSON;
    const canEdit = dashboard && dashboard.meta.canEdit;
    const styles = getPanelInspectorStyles();

    return (
      <div className={styles.wrap}>
        <div className={styles.toolbar} aria-label={selectors.components.PanelInspector.Json.content}>
          <Field label={t('dashboard.inspect-json.select-source', 'Select source')} className="flex-grow-1">
            <Select
              inputId="select-source-dropdown"
              options={jsonOptions}
              value={selected}
              onChange={this.onSelectChanged}
            />
          </Field>
          {this.hasPanelJSON && isPanelJSON && canEdit && (
            <Button className={styles.toolbarItem} onClick={this.onApplyPanelModel}>
              Apply
            </Button>
          )}
          {show === ShowContent.DataFrames && (
            <Button className={styles.toolbarItem} onClick={this.onShowHelpWizard}>
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
                onBlur={this.onTextChanged}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  }
}

function getPrettyJSON(obj: any): string {
  let r = '';
  try {
    r = JSON.stringify(obj, null, 2);
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
