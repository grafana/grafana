import { isEqual } from 'lodash';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneDataTransformer,
  sceneGraph,
  SceneGridItemStateLike,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneQueryRunner,
  sceneUtils,
  VizPanel,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { Alert, Button, CodeEditor, Field, Select, useStyles2 } from '@grafana/ui';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelInspectorStyles2 } from 'app/features/inspector/styles';
import { InspectTab } from 'app/features/inspector/types';
import { getPrettyJSON } from 'app/features/inspector/utils/utils';
import { reportPanelInspectInteraction } from 'app/features/search/page/reporting';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { gridItemToGridLayoutItemKind } from '../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { buildVizPanel } from '../serialization/layoutSerializers/utils';
import { buildGridItemForPanel } from '../serialization/transformSaveModelToScene';
import { gridItemToPanel, vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
import { vizPanelToSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import {
  getDashboardSceneFor,
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isLibraryPanel,
} from '../utils/utils';
import { isGridLayoutItemKind, isPanelKindV2 } from '../v2schema/validation';

export type ShowContent = 'panel-json' | 'panel-data' | 'data-frames' | 'panel-layout';

export interface InspectJsonTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
  source: ShowContent;
  jsonText: string;
  onClose: () => void;
  error?: string;
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
    const dashboard = getDashboardSceneFor(panel);
    const dataProvider = panel.state.$data ?? panel.parent?.state.$data;
    const isV2 = isDashboardV2Spec(dashboard.getSaveModel());

    const options: Array<SelectableValue<ShowContent>> = [
      {
        label: isV2
          ? t('dashboard.inspect-json.panel-spec-label', 'Panel Spec')
          : t('dashboard.inspect-json.panel-json-label', 'Panel JSON'),
        description: t(
          'dashboard.inspect-json.panel-json-description',
          'The model saved in the dashboard JSON that configures how everything works.'
        ),
        value: 'panel-json',
      },
    ];

    if (isV2 && panel.parent instanceof DashboardGridItem) {
      options.push({
        label: t('dashboard.inspect-json.panel-layout-label', 'Panel Layout'),
        description: t(
          'dashboard.inspect-json.panel-layout-description',
          'The grid position and size of the panel in the dashboard.'
        ),
        value: 'panel-layout',
      });
    }

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
    this.setState({
      source: value.value!,
      jsonText: getJsonText(value.value!, this.state.panelRef.resolve()),
      error: undefined,
    });
  };

  public onApplyChange = () => {
    let jsonObj: unknown;
    try {
      jsonObj = JSON.parse(this.state.jsonText);
    } catch (e) {
      this.setState({
        error: t('dashboard-scene.inspect-json-tab.error-invalid-json', 'Invalid JSON'),
      });
      return;
    }

    if (this.state.source === 'panel-layout') {
      this.applyLayoutChange(jsonObj);
    } else if (this.state.source === 'panel-json') {
      this.applyPanelJsonChange(jsonObj);
    }
  };

  private applyLayoutChange(jsonObj: unknown) {
    if (!isGridLayoutItemKind(jsonObj)) {
      this.setState({
        error: t(
          'dashboard-scene.inspect-json-tab.error-invalid-layout',
          'Layout JSON did not pass validation. Please check the JSON and try again.'
        ),
      });
      return;
    }

    const panel = this.state.panelRef.resolve();
    const dashboard = getDashboardSceneFor(panel);
    const gridItem = panel.parent;

    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Cannot update layout: panel parent is not a DashboardGridItem');
      return;
    }

    const originalElementName = dashboardSceneGraph.getElementIdentifierForVizPanel(panel);
    if (jsonObj.spec.element.name !== originalElementName) {
      this.setState({
        error: t(
          'dashboard-scene.inspect-json-tab.error-element-changed',
          'Cannot change the element reference. Only layout properties (x, y, width, height) can be modified.'
        ),
      });
      return;
    }

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    const oldState = gridItem.state;
    const newLayoutState = {
      x: jsonObj.spec.x,
      y: jsonObj.spec.y,
      width: jsonObj.spec.width,
      height: jsonObj.spec.height,
    };

    gridItem.setState(newLayoutState);

    // Force the grid layout to re-render with the new positions
    const layout = sceneGraph.getLayout(panel);
    if (layout instanceof SceneGridLayout) {
      layout.forceRender();
    }

    reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
      panel_type_changed: false,
      panel_id_changed: false,
      panel_grid_pos_changed:
        oldState.x !== newLayoutState.x ||
        oldState.y !== newLayoutState.y ||
        oldState.width !== newLayoutState.width ||
        oldState.height !== newLayoutState.height,
      panel_targets_changed: false,
    });

    this.state.onClose();
  }

  private applyPanelJsonChange(jsonObj: unknown) {
    const panel = this.state.panelRef.resolve();
    const dashboard = getDashboardSceneFor(panel);

    if (isDashboardV2Spec(dashboard.getSaveModel())) {
      this.applyV2PanelChange(jsonObj, panel, dashboard);
    } else {
      this.applyV1PanelChange(jsonObj, panel, dashboard);
    }
  }

  private applyV2PanelChange(jsonObj: unknown, panel: VizPanel, dashboard: DashboardScene) {
    if (!isPanelKindV2(jsonObj)) {
      this.setState({
        error: t(
          'dashboard-scene.inspect-json-tab.error-invalid-v2-panel',
          'Panel JSON did not pass validation. Please check the JSON and try again.'
        ),
      });
      return;
    }

    const vizPanel = buildVizPanel(jsonObj, jsonObj.spec.id);

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
      panel_type_changed: panel.state.pluginId !== jsonObj.spec.vizConfig.group,
      panel_id_changed: getPanelIdForVizPanel(panel) !== jsonObj.spec.id,
      panel_grid_pos_changed: false,
      panel_targets_changed: hasQueriesChanged(getQueryRunnerFor(panel), getQueryRunnerFor(vizPanel.state.$data)),
    });

    panel.setState(vizPanel.state);
    this.state.onClose();
  }

  private applyV1PanelChange(jsonObj: unknown, panel: VizPanel, dashboard: DashboardScene) {
    const panelModel = new PanelModel(jsonObj);
    const gridItem = buildGridItemForPanel(panelModel);
    const newState = sceneUtils.cloneSceneObjectState(gridItem.state);

    if (!(panel.parent instanceof DashboardGridItem)) {
      console.error('Cannot update state of panel', panel, gridItem);
      return;
    }

    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }

    panel.parent.setState(newState);

    // Force the grid layout to re-render with the new positions
    const layout = sceneGraph.getLayout(panel);
    if (layout instanceof SceneGridLayout) {
      layout.forceRender();
    }

    reportPanelInspectInteraction(InspectTab.JSON, 'apply', {
      panel_type_changed: panel.state.pluginId !== panelModel.type,
      panel_id_changed: getPanelIdForVizPanel(panel) !== panelModel.id,
      panel_grid_pos_changed: hasGridPosChanged(panel.parent.state, newState),
      panel_targets_changed: hasQueriesChanged(getQueryRunnerFor(panel), getQueryRunnerFor(newState.$data)),
    });

    this.state.onClose();
  }

  public onCodeEditorBlur = (value: string) => {
    this.setState({ jsonText: value });
  };

  public isEditable() {
    if (!['panel-json', 'panel-layout'].includes(this.state.source)) {
      return false;
    }

    const panel = this.state.panelRef.resolve();

    // Library panels are not editable from the inspect
    if (isLibraryPanel(panel)) {
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
  const { source: show, jsonText, error } = model.useState();
  const styles = useStyles2(getPanelInspectorStyles2);
  const options = model.getOptions();

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} data-testid={selectors.components.PanelInspector.Json.content}>
        <Field label={t('dashboard.inspect-json.select-source', 'Select source')} className="flex-grow-1" noMargin>
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

      {error && (
        <Alert severity="error" title={t('dashboard-scene.inspect-json-tab.validation-error', 'Validation error')}>
          <p>{error}</p>
        </Alert>
      )}

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
      break;
    }

    case 'panel-layout': {
      reportPanelInspectInteraction(InspectTab.JSON, 'panelLayout');

      const gridItem = panel.parent;

      if (gridItem instanceof DashboardGridItem) {
        if (isDashboardV2Spec(getDashboardSceneFor(panel).getSaveModel())) {
          objToStringify = gridItemToGridLayoutItemKind(gridItem);
        }
      }
      break;
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
