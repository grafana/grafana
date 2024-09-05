import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, PanelPluginMeta, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel, sceneGraph } from '@grafana/scenes';
import { Button, Card, FilterInput, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { AngularDeprecationPluginNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationPluginNotice';

import { isPanelAngularPlugin } from '../scene/AngularDeprecation';

import { PanelEditor } from './PanelEditor';
import { PanelOptions } from './PanelOptions';
import { PanelVizTypePicker } from './PanelVizTypePicker';

export interface PanelOptionsPaneState extends SceneObjectState {
  isVizPickerOpen?: boolean;
  searchQuery: string;
  listMode: OptionFilter;
}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  public constructor(state: Partial<PanelOptionsPaneState>) {
    super({
      searchQuery: '',
      listMode: OptionFilter.All,
      ...state,
    });
  }

  onToggleVizPicker = () => {
    this.setState({ isVizPickerOpen: !this.state.isVizPickerOpen });
  };

  onSetSearchQuery = (searchQuery: string) => {
    this.setState({ searchQuery });
  };

  onSetListMode = (listMode: OptionFilter) => {
    this.setState({ listMode });
  };

  onOpenPanelJSON = (vizPanel: VizPanel) => {
    locationService.partial({
      inspect: vizPanel.state.key,
      inspectTab: 'json',
    });
  };

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { isVizPickerOpen, searchQuery, listMode } = model.useState();
    const vizManager = sceneGraph.getAncestor(model, PanelEditor).state.vizManager;
    const { pluginId, panel } = vizManager.useState();
    const { data } = sceneGraph.getData(vizManager.state.panel).useState();
    const styles = useStyles2(getStyles);
    const isAngularPanel = isPanelAngularPlugin(panel);
    return (
      <>
        {!isVizPickerOpen && (
          <>
            <div className={styles.top}>
              <VisualizationButton pluginId={pluginId} onOpen={model.onToggleVizPicker} />
              <FilterInput
                className={styles.searchOptions}
                value={searchQuery}
                placeholder="Search options"
                onChange={model.onSetSearchQuery}
              />
            </div>
            {isAngularPanel && (
              <div className={styles.angularDeprecationContainer}>
                <AngularDeprecationPluginNotice
                  showPluginDetailsLink={true}
                  pluginId={pluginId}
                  pluginType={PluginType.panel}
                  angularSupportEnabled={config?.angularSupportEnabled}
                  interactionElementId="panel-options"
                />
                <>
                  <Card.Heading>
                    <Trans i18nKey="dashboards.panel-edit.angular-deprecation-heading"> Angular Panel Options </Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Trans i18nKey="dashboards.panel-edit.angular-deprecation-description">
                      {' '}
                      This panel is built with AngularJS. To modify the panel options, use the Panel JSON editor.
                    </Trans>
                  </Card.Description>
                  <Card.Actions>
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      onClick={() => {
                        model.onOpenPanelJSON(panel);
                      }}
                    >
                      <Trans i18nKey="dashboards.panel-edit.angular-deprecation-button-open-panel-json">
                        Open Panel JSON
                      </Trans>
                    </Button>
                  </Card.Actions>
                </>
              </div>
            )}
            <div className={styles.listOfOptions}>
              <PanelOptions vizManager={vizManager} searchQuery={searchQuery} listMode={listMode} data={data} />
            </div>
          </>
        )}
        {isVizPickerOpen && (
          <PanelVizTypePicker vizManager={vizManager} onChange={model.onToggleVizPicker} data={data} />
        )}
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    top: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 1),
      gap: theme.spacing(2),
    }),
    listOfOptions: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '1',
      overflow: 'auto',
    }),
    searchOptions: css({
      minHeight: theme.spacing(4),
    }),
    searchWrapper: css({
      padding: theme.spacing(2, 2, 2, 0),
    }),
    vizField: css({
      marginBottom: theme.spacing(1),
    }),
    rotateIcon: css({
      rotate: '180deg',
    }),
    angularDeprecationContainer: css({
      label: 'angular-deprecation-container',
      padding: theme.spacing(1),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    }),
  };
}

interface VisualizationButtonProps {
  pluginId: string;
  onOpen: () => void;
}

export function VisualizationButton({ pluginId, onOpen }: VisualizationButtonProps) {
  const styles = useStyles2(getVizButtonStyles);
  let pluginMeta: PanelPluginMeta | undefined = useMemo(
    () => getAllPanelPluginMeta().filter((p) => p.id === pluginId)[0],
    [pluginId]
  );

  if (!pluginMeta) {
    const notFound = getPanelPluginNotFound(`Panel plugin not found (${pluginId})`, true);
    pluginMeta = notFound.meta;
  }

  return (
    <Stack gap={1}>
      <ToolbarButton
        className={styles.vizButton}
        tooltip="Click to change visualization"
        imgSrc={pluginMeta.info.logos.small}
        onClick={onOpen}
        data-testid={selectors.components.PanelEditor.toggleVizPicker}
        aria-label="Change Visualization"
        variant="canvas"
        isOpen={false}
        fullWidth
      >
        {pluginMeta.name}
      </ToolbarButton>
    </Stack>
  );
}

function getVizButtonStyles(theme: GrafanaTheme2) {
  return {
    vizButton: css({
      textAlign: 'left',
    }),
  };
}
