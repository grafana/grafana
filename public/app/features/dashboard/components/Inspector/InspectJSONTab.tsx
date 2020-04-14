import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { chain } from 'lodash';

import { PanelData, SelectableValue, AppEvents } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { TextArea, stylesFactory, Button, Select, ClipboardButton, HorizontalGroup, JSONFormatter } from '@grafana/ui';
import { css } from 'emotion';
import { appEvents } from 'app/core/core';
import { replacePanel } from 'app/features/dashboard/utils/panel';
import { PanelModel, DashboardModel } from '../../state';
import { Field } from '@grafana/ui/src/components/Forms/Field';

enum ShowContent {
  PanelJSON = 'panel',
  PanelData = 'data',
  DataStructure = 'structure',
}

const options: Array<SelectableValue<ShowContent>> = [
  {
    label: 'Panel JSON',
    description: 'The model saved in the dashboard JSON that configures how everythign works.',
    value: ShowContent.PanelJSON,
  },
  {
    label: 'Panel data',
    description: 'The raw model passed to the panel visualization',
    value: ShowContent.PanelData,
  },
  {
    label: 'DataFrame structure',
    description: 'Response info without any values',
    value: ShowContent.DataStructure,
  },
];

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  data: PanelData;
}

interface State {
  show: ShowContent;
  text: string;
}

export class InspectJSONTab extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      show: ShowContent.PanelJSON,
      text: getSaveModelJSON(props.panel),
    };
  }

  onSelectChanged = (item: SelectableValue<ShowContent>) => {
    let text = '';
    if (item.value === ShowContent.PanelJSON) {
      text = getSaveModelJSON(this.props.panel);
    }
    this.setState({ text, show: item.value });
  };

  onTextChanged = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const text = e.currentTarget.value;
    this.setState({ text });
  };

  getJSONObject = (show: ShowContent): any => {
    if (show === ShowContent.PanelData) {
      return this.props.data;
    }
    if (show === ShowContent.DataStructure) {
      const series = this.props.data?.series;
      if (!series) {
        return { note: 'Missing Response Data' };
      }
      return this.props.data.series.map(frame => {
        const fields = frame.fields.map(field => {
          return chain(field)
            .omit('values')
            .omit('calcs')
            .omit('display')
            .value();
        });
        return {
          ...frame,
          fields,
        };
      });
    }
    if (show === ShowContent.PanelJSON) {
      return this.props.panel.getSaveModel();
    }

    return { note: 'Unknown Object', show };
  };

  getClipboardText = () => {
    const { show } = this.state;
    const obj = this.getJSONObject(show);
    return JSON.stringify(obj, null, 2);
  };

  onClipboardCopied = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
    alert('TODO... the notice is behind the inspector!');
  };

  onApplyPanelModel = () => {
    const { panel, dashboard } = this.props;
    try {
      if (!dashboard.meta.canEdit) {
        appEvents.emit(AppEvents.alertError, ['Unable to Apply']);
      } else {
        const newPanel = JSON.parse(this.state.text);
        replacePanel(dashboard, newPanel, panel);
        appEvents.emit(AppEvents.alertSuccess, ['Applied Changes']);
      }
    } catch (err) {
      console.log('Error applyign updates', err);
      appEvents.emit(AppEvents.alertError, ['Invalid JSON Text']);
    }

    // Close the inspector
    getLocationSrv().update({
      query: { inspect: null, inspectTab: null },
      partial: true,
    });
  };

  render() {
    const { dashboard } = this.props;
    const { show } = this.state;
    const selected = options.find(v => v.value === show);
    const isPanelJSON = show === ShowContent.PanelJSON;
    const canEdit = dashboard.meta.canEdit;

    const styles = getStyles();

    return (
      <div className={styles.wrap}>
        <Field label="Select source">
          <Select options={options} value={selected} onChange={this.onSelectChanged} />
        </Field>
        <div className={styles.content}>
          {/* <Label>JSON</Label> */}
          <AutoSizer disableWidth={true}>
            {({ height }) => {
              const jsonStyles = { height: height - 30 };
              if (isPanelJSON) {
                return (
                  <TextArea
                    style={jsonStyles}
                    spellCheck={false}
                    value={this.state.text}
                    onChange={this.onTextChanged}
                    className={styles.editor}
                  />
                );
              }
              return (
                <div style={jsonStyles} className={styles.viewer}>
                  <JSONFormatter json={this.getJSONObject(show)} />
                </div>
              );
            }}
          </AutoSizer>
        </div>
        <div>
          <HorizontalGroup>
            {isPanelJSON && canEdit && <Button onClick={this.onApplyPanelModel}>Apply</Button>}
            <ClipboardButton
              variant="secondary"
              getText={this.getClipboardText}
              onClipboardCopy={this.onClipboardCopied}
            >
              Copy to clipboard
            </ClipboardButton>
          </HorizontalGroup>
        </div>
      </div>
    );
  }
}

function getSaveModelJSON(panel: PanelModel): string {
  return JSON.stringify(panel.getSaveModel(), null, 2);
}

const getStyles = stylesFactory(() => {
  return {
    wrap: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    `,
    content: css`
      flex: 1;
    `,
    editor: css`
      font-family: monospace;
      border: 1px solid #222;
      margin-bottom: 5px;
    `,
    viewer: css`
      overflow: scroll;
    `,
  };
});
