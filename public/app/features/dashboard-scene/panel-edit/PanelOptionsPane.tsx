import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useMedia, useToggle } from 'react-use';

import {
  FieldConfigSource,
  filterFieldConfigOverrides,
  GrafanaTheme2,
  isStandardFieldProp,
  PanelPluginMeta,
  restoreCustomOverrideRules,
  SelectableValue,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import {
  DeepPartial,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Button, FilterInput, ScrollContainer, Stack, ToolbarButton, useStyles2, Field } from '@grafana/ui';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

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

    if (options.options) {
      panel.onOptionsChange(options.options, true);
    }

    if (options.fieldConfig) {
      panel.onFieldConfigChange(options.fieldConfig, true);
    }

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
    const isSearching = searchQuery.length > 0;
    const hasFieldConfig = !isSearching && !panel.getPlugin()?.fieldConfigRegistry.isEmpty();
    const [isSearchingOptions, setIsSearchingOptions] = useToggle(false);
    const onlyOverrides = listMode === OptionFilter.Overrides;

    // @ts-expect-error no magic numbers!
    const noScroll = useMedia('(max-height: 500px)');

    return (
      <>
        {!isVizPickerOpen && (
          <>
            <div className={styles.top}>
              <Field
                label={t('dashboard.panel-edit.visualization-button-label', 'Visualization')}
                className={styles.vizField}
              >
                <Stack gap={1}>
                  <VisualizationButton pluginId={pluginId} onOpen={model.onToggleVizPicker} />
                  <Button
                    icon="search"
                    variant="secondary"
                    onClick={setIsSearchingOptions}
                    tooltip={t('dashboard.panel-edit.visualization-button-tooltip', 'Search options')}
                  />
                  {hasFieldConfig && (
                    <ToolbarButton
                      icon="filter"
                      tooltip={t('dashboard.panel-edit.only-overrides-button-tooltip', 'Show only overrides')}
                      variant={onlyOverrides ? 'active' : 'canvas'}
                      onClick={() => {
                        model.onSetListMode(onlyOverrides ? OptionFilter.All : OptionFilter.Overrides);
                      }}
                    />
                  )}
                </Stack>
              </Field>

              {isSearchingOptions && (
                <FilterInput
                  className={styles.searchOptions}
                  value={searchQuery}
                  placeholder={t('dashboard.panel-edit.placeholder-search-options', 'Search options')}
                  onChange={model.onSetSearchQuery}
                  autoFocus={true}
                  onBlur={() => {
                    if (searchQuery.length === 0) {
                      setIsSearchingOptions(false);
                    }
                  }}
                />
              )}
            </div>
            <ScrollContainer minHeight={noScroll ? 'max-content' : 0}>
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
      padding: theme.spacing(1, 2, 2, 2),
      gap: theme.spacing(2),
    }),
    searchOptions: css({
      minHeight: theme.spacing(4),
    }),
    searchWrapper: css({
      padding: theme.spacing(2, 2, 2, 0),
    }),
    vizField: css({
      marginBottom: theme.spacing(0),
    }),
    rotateIcon: css({
      rotate: '180deg',
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
    <ToolbarButton
      className={styles.vizButton}
      tooltip={t(
        'dashboard-scene.visualization-button.tooltip-click-to-change-visualization',
        'Click to change visualization'
      )}
      imgSrc={pluginMeta.info.logos.small}
      onClick={onOpen}
      data-testid={selectors.components.PanelEditor.toggleVizPicker}
      aria-label={t('dashboard-scene.visualization-button.aria-label-change-visualization', 'Change visualization')}
      variant="canvas"
      isOpen={false}
      fullWidth
    >
      {pluginMeta.name}
    </ToolbarButton>
  );
}

function getVizButtonStyles(theme: GrafanaTheme2) {
  return {
    vizButton: css({
      textAlign: 'left',
    }),
  };
}
