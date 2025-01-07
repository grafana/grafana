import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  FieldConfigSource,
  filterFieldConfigOverrides,
  GrafanaTheme2,
  isStandardFieldProp,
  PanelPluginMeta,
  restoreCustomOverrideRules,
  PluginType,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import {
  DeepPartial,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import {
  Button,
  Card,
  FilterInput,
  RadioButtonGroup,
  ScrollContainer,
  Stack,
  ToolbarButton,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { AngularDeprecationPluginNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationPluginNotice';

import { isUsingAngularPanelPlugin } from '../scene/angular/AngularDeprecation';

import { PanelOptions } from './PanelOptions';
import { PanelVizTypePicker } from './PanelVizTypePicker';
import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './interaction';

export interface PanelOptionsPaneState extends SceneObjectState {
  isVizPickerOpen?: boolean;
  searchQuery: string;
  listMode: OptionFilter;
  panelRef: SceneObjectRef<VizPanel>;
}

interface PluginOptionsCache {
  options: DeepPartial<{}>;
  fieldConfig: FieldConfigSource<DeepPartial<{}>>;
}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  private _cachedPluginOptions: Record<string, PluginOptionsCache | undefined> = {};

  onToggleVizPicker = () => {
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.TOGGLE_DROPDOWN,
      open: !this.state.isVizPickerOpen,
    });
    this.setState({ isVizPickerOpen: !this.state.isVizPickerOpen });
  };

  onChangePanelPlugin = (options: VizTypeChangeDetails) => {
    const panel = this.state.panelRef.resolve();
    const { options: prevOptions, fieldConfig: prevFieldConfig, pluginId: prevPluginId } = panel.state;
    const pluginId = options.pluginId;
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_PANEL_PLUGIN,
      plugin_id: pluginId,
    });

    // clear custom options
    let newFieldConfig: FieldConfigSource = {
      defaults: {
        ...prevFieldConfig.defaults,
        custom: {},
      },
      overrides: filterFieldConfigOverrides(prevFieldConfig.overrides, isStandardFieldProp),
    };

    this._cachedPluginOptions[prevPluginId] = { options: prevOptions, fieldConfig: prevFieldConfig };

    const cachedOptions = this._cachedPluginOptions[pluginId]?.options;
    const cachedFieldConfig = this._cachedPluginOptions[pluginId]?.fieldConfig;

    if (cachedFieldConfig) {
      newFieldConfig = restoreCustomOverrideRules(newFieldConfig, cachedFieldConfig);
    }

    panel.changePluginType(pluginId, cachedOptions, newFieldConfig);
    this.onToggleVizPicker();
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

  getOptionRadioFilters(): Array<SelectableValue<OptionFilter>> {
    return [
      { label: OptionFilter.All, value: OptionFilter.All },
      { label: OptionFilter.Overrides, value: OptionFilter.Overrides },
    ];
  }

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { isVizPickerOpen, searchQuery, listMode, panelRef } = model.useState();
    const panel = panelRef.resolve();
    const { pluginId } = panel.useState();
    const { data } = sceneGraph.getData(panel).useState();
    const styles = useStyles2(getStyles);
    const isAngularPanel = isUsingAngularPanelPlugin(panel);
    const isSearching = searchQuery.length > 0;
    const showSearchRadioButtons = !isSearching && !panel.getPlugin()?.fieldConfigRegistry.isEmpty();
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
              {showSearchRadioButtons && (
                <RadioButtonGroup
                  options={model.getOptionRadioFilters()}
                  value={listMode}
                  fullWidth
                  onChange={model.onSetListMode}
                />
              )}
            </div>
            {isAngularPanel && (
              <div className={styles.angularDeprecationContainer}>
                <AngularDeprecationPluginNotice
                  showPluginDetailsLink={true}
                  pluginId={pluginId}
                  pluginType={PluginType.panel}
                  angularSupportEnabled={config?.angularSupportEnabled}
                  interactionElementId="panel-options"
                >
                  <Card.Heading>
                    <Trans i18nKey="dashboards.panel-edit.angular-deprecation-heading">Panel options</Trans>
                  </Card.Heading>
                  <Card.Description>
                    <Trans i18nKey="dashboards.panel-edit.angular-deprecation-description">
                      Angular panels options can only be edited using the JSON editor.
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
                        Open JSON editor
                      </Trans>
                    </Button>
                  </Card.Actions>
                </AngularDeprecationPluginNotice>
              </div>
            )}
            <ScrollContainer>
              <PanelOptions panel={panel} searchQuery={searchQuery} listMode={listMode} data={data} />
            </ScrollContainer>
          </>
        )}
        {isVizPickerOpen && (
          <PanelVizTypePicker
            panel={panel}
            onChange={model.onChangePanelPlugin}
            onClose={model.onToggleVizPicker}
            data={data}
          />
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
