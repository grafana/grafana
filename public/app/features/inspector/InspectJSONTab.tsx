import { t } from '@lingui/macro';
import { saveAs } from 'file-saver';
import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { firstValueFrom } from 'rxjs';

import {
  AppEvents,
  DataFrameJSON,
  dataFrameToJSON,
  DataTopic,
  PanelData,
  SelectableValue,
  LoadingState,
  dateTimeFormat,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { Button, CodeEditor, Field, Select, HorizontalGroup, InlineSwitch } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';

import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getPanelInspectorStyles } from '../inspector/styles';
import { pendingImportDashboard } from '../manage-dashboards/DashboardImportPage';

import { Randomize } from './randomizer';
import { getTroubleshootingDashboard } from './troubleshooting';

enum ShowContent {
  PanelJSON = 'panel',
  PanelData = 'data',
  DataFrames = 'frames',
  TroubleshootingDashboard = 'dash',
}

const options: Array<SelectableValue<ShowContent>> = [
  {
    label: t({ id: 'dashboard.inspect-json.panel-json-label', message: 'Panel JSON' }),
    description: t({
      id: 'dashboard.inspect-json.panel-json-description',
      message: 'The model saved in the dashboard JSON that configures how everything works.',
    }),
    value: ShowContent.PanelJSON,
  },
  {
    label: t({ id: 'dashboard.inspect-json.panel-data-label', message: 'Panel data' }),
    description: t({
      id: 'dashboard.inspect-json.panel-data-description',
      message: 'The raw model passed to the panel visualization',
    }),
    value: ShowContent.PanelData,
  },
  {
    label: t({ id: 'dashboard.inspect-json.dataframe-label', message: 'DataFrame JSON (from Query)' }),
    description: t({
      id: 'dashboard.inspect-json.dataframe-description',
      message: 'Raw data without transformations and field config applied. ',
    }),
    value: ShowContent.DataFrames,
  },
  {
    label: 'Troubleshooting dashboard',
    description: 'Create a dashboard to show help reproduce issues',
    value: ShowContent.TroubleshootingDashboard,
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
  rand: Randomize;
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
      rand: {}, // none
    };
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

  doImportDashboard = () => {
    pendingImportDashboard.dashboard = JSON.parse(this.state.text);
    locationService.push('/dashboard/import');
    appEvents.emit(AppEvents.alertSuccess, ['Select a folder and click import']);
  };

  doSaveDashboard = () => {
    const blob = new Blob([this.state.text], {
      type: 'application/json',
    });
    const displayTitle = `${this.props.panel?.title}`;
    const fileName = `troubleshoot-${displayTitle}-${dateTimeFormat(new Date())}.json`;
    saveAs(blob, fileName);
  };

  toggleRandomize = (k: keyof Randomize) => {
    const rand = { ...this.state.rand };
    rand[k] = !rand[k];
    this.setState({ rand });

    // This will update the text values async
    this.onSelectChanged({ value: this.state.show });
  };

  async getJSONObject(show: ShowContent) {
    const { data, panel } = this.props;
    if (show === ShowContent.PanelData) {
      return data;
    }

    if (show === ShowContent.DataFrames) {
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

    if (show === ShowContent.TroubleshootingDashboard && panel) {
      return await getTroubleshootingDashboard(panel, this.state.rand, getTimeSrv().timeRange());
    }

    if (this.hasPanelJSON && show === ShowContent.PanelJSON) {
      return panel!.getSaveModel();
    }

    return { note: t({ id: 'dashboard.inspect-json.unknown', message: `Unknown Object: ${show}` }) };
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

  render() {
    const { dashboard } = this.props;
    const { show, text, rand } = this.state;
    const jsonOptions = this.hasPanelJSON ? options : options.slice(1, options.length);
    const selected = options.find((v) => v.value === show);
    const isPanelJSON = show === ShowContent.PanelJSON;
    const isTroubleshooter = show === ShowContent.TroubleshootingDashboard;
    const canEdit = dashboard && dashboard.meta.canEdit;
    const styles = getPanelInspectorStyles();

    return (
      <div className={styles.wrap}>
        <div className={styles.toolbar} aria-label={selectors.components.PanelInspector.Json.content}>
          <Field
            label={t({ id: 'dashboard.inspect-json.select-source', message: 'Select source' })}
            className="flex-grow-1"
          >
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
          {isTroubleshooter && (
            <>
              {canEdit && (
                <Button className={styles.toolbarItem} onClick={this.doImportDashboard}>
                  Import
                </Button>
              )}
              <Button className={styles.toolbarItem} onClick={this.doSaveDashboard}>
                Download
              </Button>
            </>
          )}
        </div>
        {isTroubleshooter && (
          <div>
            <Field
              label="Randomize data"
              description="Modify the original data to hide sensitve information.  Note the lengths will stay the same, and duplicate values will be equal."
            >
              <HorizontalGroup>
                <InlineSwitch
                  label="Labels"
                  showLabel={true}
                  value={Boolean(rand.labels)}
                  onChange={(v) => this.toggleRandomize('labels')}
                />
                <InlineSwitch
                  label="Field names"
                  showLabel={true}
                  value={Boolean(rand.names)}
                  onChange={(v) => this.toggleRandomize('names')}
                />
                <InlineSwitch
                  label="String values"
                  showLabel={true}
                  value={Boolean(rand.values)}
                  onChange={(v) => this.toggleRandomize('values')}
                />
              </HorizontalGroup>
            </Field>
            <Field
              label="About"
              description={
                <span>
                  This creates a dashboard that can be downloaed and attached to github issues or sent to support. It
                  contains relevant data required to reproduce visualization issues disconnected from the original
                  datasource.
                </span>
              }
            >
              <div></div>
            </Field>
          </div>
        )}
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
                readOnly={!(isPanelJSON || isTroubleshooter)}
                onBlur={this.onTextChanged}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  }
}

export function getPanelDataFrames(data?: PanelData): DataFrameJSON[] {
  const frames: DataFrameJSON[] = [];
  if (data?.series) {
    for (const f of data.series) {
      frames.push(dataFrameToJSON(f));
    }
  }
  if (data?.annotations) {
    for (const f of data.annotations) {
      const json = dataFrameToJSON(f);
      if (!json.schema?.meta) {
        json.schema!.meta = {};
      }
      json.schema!.meta.dataTopic = DataTopic.Annotations;
      frames.push(json);
    }
  }
  return frames;
}

function getPrettyJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}
