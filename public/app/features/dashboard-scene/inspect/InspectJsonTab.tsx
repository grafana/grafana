import { isEqual } from 'lodash';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import {
  SceneComponentProps,
  SceneDataTransformer,
  sceneGraph,
  SceneGridItemStateLike,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  sceneUtils,
  VizPanel,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema/';
import { Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelInspectorStyles2 } from 'app/features/inspector/styles';
import { InspectTab } from 'app/features/inspector/types';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { reportPanelInspectInteraction } from 'app/features/search/page/reporting';

import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { buildGridItemForPanel } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel, vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { vizPanelToSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import {
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isLibraryPanel,
} from '../utils/utils';

export type ShowContent = 'panel-json' | 'panel-data' | 'data-frames';

export interface InspectJsonTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  source: ShowContent;
  jsonText: string;
  onClose: () => void;
}

export class InspectJsonTab extends SceneObjectBase<InspectJsonTabState> {
  public constructor(state: Omit<InspectJsonTabState, 'source' | 'jsonText'>) {
    super({
      ...state,
      source: 'panel-json',
      jsonText: getJsonText('panel-json', state.panelRef.resolve()),
    });
  }

  public getTabLabel() {
    return t('dashboard.inspect.json-tab', 'JSON');
  }

  public getTabValue() {
    return InspectTab.JSON;
  }

  public getOptions(): Array<SelectableValue<ShowContent>> {
    const panel = this.state.panelRef.resolve();
    const dataProvider = panel.state.$data ?? panel.parent?.state.$data;

    const options: Array<SelectableValue<ShowContent>> = [
      {
        label: t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
        description: t(
          'dashboard.inspect-json.panel-json-description',
          'The model saved in the dashboard JSON that configures how everything works.'
        ),
        value: 'panel-json',
      },
    ];

    if (dataProvider) {
      options.push({
        label: t('dashboard.inspect-json.panel-data-label', 'Panel data'),
        description: t(
          'dashboard.inspect-json.panel-data-description',
          'The raw model passed to the panel visualization'
        ),
        value: 'panel-data',
      });
      options.push({
        label: t('dashboard.inspect-json.dataframe-label', 'DataFrame JSON (from Query)'),
        description: t(
          'dashboard.inspect-json.dataframe-description',
          'Raw data without transformations and field config applied. '
        ),
        value: 'data-frames',
      });
    }

    return options;
  }

  public onChangeSource = (value: SelectableValue<ShowContent>) => {
    this.setState({ source: value.value!, jsonText: getJsonText(value.value!, this.state.panelRef.resolve()) });
  };

  public onApplyChange = () => {
    const panel = this.state.panelRef.resolve();
    const dashboard = getDashboardSceneFor(panel);
    const jsonObj = JSON.parse(this.state.jsonText);

    const panelModel = new PanelModel(jsonObj);
    const gridItem = buildGridItemForPanel(panelModel);
    const newState = sceneUtils.cloneSceneObjectState(gridItem.state);

    if (!(panel.parent instanceof DashboardGridItem)) {
      console.error('Cannot update state of panel', panel, gridItem);
      return;
    }

    this.state.onClose();

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    panel.parent.setState(newState);

    //Report relevant updates
    reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
      panel_type_changed: panel.state.pluginId !== panelModel.type,
      panel_id_changed: getPanelIdForVizPanel(panel) !== panelModel.id,
      panel_grid_pos_changed: hasGridPosChanged(panel.parent.state, newState),
      panel_targets_changed: hasQueriesChanged(getQueryRunnerFor(panel), getQueryRunnerFor(newState.$data)),
    });
  };

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public isEditable() {
    if (this.state.source !== 'panel-json') {
      return false;
    }

    const panel = this.state.panelRef.resolve();

    // Library panels are not editable from the inspect
    if (isLibraryPanel(panel)) {
      return false;
    }

    // V2 dashboard panels are not editable from the inspect
    if (isDashboardV2Spec(getDashboardSceneFor(panel).getSaveModel())) {
      return false;
    }

    // Only support normal grid items for now and not repeated items
    if (panel.parent instanceof DashboardGridItem && panel.parent.isRepeated()) {
      return false;
    }

    const dashboard = getDashboardSceneFor(panel);
    return dashboard.state.meta.canEdit;
  }

  static Component = InspectJsonTabComponent;
}

function InspectJsonTabComponent({ model }: SceneComponentProps<InspectJsonTab>) {
  const { source: show, jsonText } = model.useState();
  const styles = useStyles2(getPanelInspectorStyles2);
  const options = model.getOptions();

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} data-testid={selectors.components.PanelInspector.Json.content}>
        <Field label={t('dashboard.inspect-json.select-source', 'Select source')} className="flex-grow-1">
          <Select
            inputId="select-source-dropdown"
            options={options}
            value={options.find((v) => v.value === show) ?? options[0].value}
            onChange={model.onChangeSource}
          />
        </Field>
        {model.isEditable() && (
          <Button className={styles.toolbarItem} onClick={model.onApplyChange}>
            <Trans i18nKey="dashboard-scene.inspect-json-tab.apply">Apply</Trans>
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
              readOnly={!model.isEditable()}
              onBlur={model.onCodeEditorBlur}
            />
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

function getJsonText(show: ShowContent, panel: VizPanel): string {
  let objToStringify: object = {};

  switch (show) {
    case 'panel-json': {
      reportPanelInspectInteraction(InspectTab.JSON, 'panelData');

      const isInspectingLibraryPanel = isLibraryPanel(panel);
      const gridItem = panel.parent;

      if (isInspectingLibraryPanel) {
        objToStringify = libraryPanelToLegacyRepresentation(panel);
        break;
      }

      if (isDashboardV2Spec(getDashboardSceneFor(panel).getSaveModel())) {
        objToStringify = vizPanelToSchemaV2(panel);
        break;
      } else {
        if (gridItem instanceof DashboardGridItem) {
          objToStringify = gridItemToPanel(gridItem);
        }
      }

      break;
    }

    case 'panel-data': {
      reportPanelInspectInteraction(InspectTab.JSON, 'panelJSON');

      const dataProvider = sceneGraph.getData(panel);
      if (dataProvider.state.data) {
        objToStringify = panel.applyFieldConfig(dataProvider.state.data);
      }
      break;
    }

    case 'data-frames': {
      reportPanelInspectInteraction(InspectTab.JSON, 'dataFrame');
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

/**
 *
 * @param panel Must hold a LibraryPanel behavior
 * @returns object representation of the legacy library panel structure.
 */
function libraryPanelToLegacyRepresentation(panel: VizPanel<{}, {}>) {
  if (!isLibraryPanel(panel)) {
    throw 'Panel not a library panel';
  }

  const gridItem = panel.parent;

  if (!(gridItem instanceof DashboardGridItem)) {
    throw 'LibraryPanel not child of DashboardGridItem';
  }

  const gridPos = {
    x: gridItem.state.x || 0,
    y: gridItem.state.y || 0,
    h: gridItem.state.height || 0,
    w: gridItem.state.width || 0,
  };
  const libraryPanelObj = vizPanelToLibraryPanel(panel);
  const panelObj = vizPanelToPanel(panel.clone({ $behaviors: undefined }), gridPos, false, gridItem);

  return { libraryPanel: { ...libraryPanelObj }, ...panelObj };
}

function vizPanelToLibraryPanel(panel: VizPanel): LibraryPanel {
  if (!isLibraryPanel(panel)) {
    throw new Error('Panel not a Library panel');
  }

  const libraryPanel = getLibraryPanelBehavior(panel);

  if (!libraryPanel) {
    throw new Error('Library panel behavior not found');
  }

  if (!libraryPanel.state._loadedPanel) {
    throw new Error('Library panel not loaded');
  }
  return libraryPanel.state._loadedPanel;
}

function hasGridPosChanged(a: SceneGridItemStateLike, b: SceneGridItemStateLike) {
  return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
}

function hasQueriesChanged(a: SceneQueryRunner | undefined, b: SceneQueryRunner | undefined) {
  if (a === undefined || b === undefined) {
    return false;
  }

  return !isEqual(a.state.queries, b.state.queries);
}
