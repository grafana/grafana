import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneComponentProps,
  SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneGridItem,
  SceneObjectBase,
  VizPanel,
} from '@grafana/scenes';
import { Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { getPanelInspectorStyles2 } from 'app/features/inspector/styles';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';

import { gridItemToPanel } from '../serialization/transformSceneToSaveModel';

import { InspectTabState } from './types';

export type ShowContent = 'panel-json' | 'panel-data' | 'data-frames';

export interface InspectJsonTabState extends InspectTabState {
  show: ShowContent;
  canEdit?: boolean;
  jsonText: string;
}

export class InspectJsonTab extends SceneObjectBase<InspectJsonTabState> {
  public constructor(state: Omit<InspectJsonTabState, 'show' | 'jsonText'>) {
    super({
      ...state,
      show: 'panel-json',
      jsonText: getJsonText('panel-json', state.panelRef.resolve()),
    });
  }

  public getOptions(dataProvider: SceneDataProvider): Array<SelectableValue<ShowContent>> {
    console.log('getOptions', dataProvider);

    return [
      {
        label: t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
        description: t(
          'dashboard.inspect-json.panel-json-description',
          'The model saved in the dashboard JSON that configures how everything works.'
        ),
        value: 'panel-json',
      },
      {
        label: t('dashboard.inspect-json.panel-data-label', 'Panel data'),
        description: t(
          'dashboard.inspect-json.panel-data-description',
          'The raw model passed to the panel visualization'
        ),
        value: 'panel-data',
      },
      {
        label: t('dashboard.inspect-json.dataframe-label', 'DataFrame JSON (from Query)'),
        description: t(
          'dashboard.inspect-json.dataframe-description',
          'Raw data without transformations and field config applied. '
        ),
        value: 'data-frames',
      },
    ];
  }

  public onChangeShow = (value: SelectableValue<ShowContent>) => {
    this.setState({ show: value.value!, jsonText: getJsonText(value.value!, this.state.panelRef.resolve()) });
  };

  public onApplyChange = () => {
    // TODO
  };

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public isReadOnly() {
    return this.state.show !== 'panel-json' || !this.state.canEdit;
  }

  static Component = ({ model }: SceneComponentProps<InspectJsonTab>) => {
    const { show, canEdit, jsonText } = model.useState();
    const styles = useStyles2(getPanelInspectorStyles2);
    const panel = model.state.panelRef.resolve();
    const dataProvider = sceneGraph.getData(panel);
    const options = model.getOptions(dataProvider);

    return (
      <div className={styles.wrap}>
        <div className={styles.toolbar} aria-label={selectors.components.PanelInspector.Json.content}>
          <Field label={t('dashboard.inspect-json.select-source', 'Select source')} className="flex-grow-1">
            <Select
              inputId="select-source-dropdown"
              options={options}
              value={options.find((v) => v.value === show) ?? options[0].value}
              onChange={model.onChangeShow}
            />
          </Field>
          {panel && canEdit && (
            <Button className={styles.toolbarItem} onClick={model.onApplyChange}>
              Apply
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
                showMiniMap={jsonText.length > 100}
                value={jsonText}
                readOnly={!model.isReadOnly()}
                onBlur={model.onCodeEditorBlur}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  };
}

function getJsonText(show: ShowContent, panel: VizPanel): string {
  let objToStringify: object = {};

  switch (show) {
    case 'panel-json': {
      if (panel.parent instanceof SceneGridItem) {
        objToStringify = gridItemToPanel(panel.parent);
      }
      break;
    }

    case 'panel-data': {
      const dataProvider = sceneGraph.getData(panel);
      if (dataProvider.state.data) {
        objToStringify = panel.applyFieldConfig(dataProvider.state.data);
      }
      break;
    }

    case 'data-frames': {
      const dataProvider = sceneGraph.getData(panel);

      if (dataProvider.state.data) {
        // Get raw untransformed data
        if (dataProvider instanceof SceneDataTransformer && dataProvider.state.$data?.state.data) {
          objToStringify = getPanelDataFrames(dataProvider.state.$data!.state.data);
        } else {
          objToStringify = getPanelDataFrames(dataProvider.state.data);
        }
      }
    }
  }

  return getPrettyJSON(objToStringify);
}
