import React, { PureComponent } from 'react';
import { chain } from 'lodash';
import { AppEvents, PanelData, SelectableValue } from '@grafana/data';
import { Button, ClipboardButton, Field, JSONFormatter, Select, TextArea } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { appEvents } from 'app/core/core';
import { DashboardModel, PanelModel } from '../../state';
import { getPanelInspectorStyles } from './styles';

enum ShowContent {
  PanelJSON = 'panel',
  PanelData = 'data',
  DataStructure = 'structure',
}

const options: Array<SelectableValue<ShowContent>> = [
  {
    label: 'Panel JSON',
    description: 'The model saved in the dashboard JSON that configures how everything works.',
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
  onClose: () => void;
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
  };

  onApplyPanelModel = () => {
    const { panel, dashboard, onClose } = this.props;

    try {
      if (!dashboard.meta.canEdit) {
        appEvents.emit(AppEvents.alertError, ['Unable to apply']);
      } else {
        const updates = JSON.parse(this.state.text);
        panel.restoreModel(updates);
        panel.refresh();
        appEvents.emit(AppEvents.alertSuccess, ['Panel model updated']);
      }
    } catch (err) {
      console.log('Error applyign updates', err);
      appEvents.emit(AppEvents.alertError, ['Invalid JSON text']);
    }

    onClose();
  };

  renderPanelJSON(styles: any) {
    return (
      <TextArea spellCheck={false} value={this.state.text} onChange={this.onTextChanged} className={styles.editor} />
    );
  }

  render() {
    const { dashboard } = this.props;
    const { show } = this.state;
    const selected = options.find(v => v.value === show);
    const isPanelJSON = show === ShowContent.PanelJSON;
    const canEdit = dashboard.meta.canEdit;
    const styles = getPanelInspectorStyles();

    return (
      <>
        <div className={styles.toolbar} aria-label={selectors.components.PanelInspector.Json.content}>
          <Field label="Select source" className="flex-grow-1">
            <Select options={options} value={selected} onChange={this.onSelectChanged} />
          </Field>
          <ClipboardButton
            variant="secondary"
            className={styles.toolbarItem}
            getText={this.getClipboardText}
            onClipboardCopy={this.onClipboardCopied}
          >
            Copy to clipboard
          </ClipboardButton>
          {isPanelJSON && canEdit && (
            <Button className={styles.toolbarItem} onClick={this.onApplyPanelModel}>
              Apply
            </Button>
          )}
        </div>
        <div className={styles.content}>
          {isPanelJSON ? (
            this.renderPanelJSON(styles)
          ) : (
            <div className={styles.viewer}>
              <JSONFormatter json={this.getJSONObject(show)} />
            </div>
          )}
        </div>
      </>
    );
  }
}

function getSaveModelJSON(panel: PanelModel): string {
  return JSON.stringify(panel.getSaveModel(), null, 2);
}
