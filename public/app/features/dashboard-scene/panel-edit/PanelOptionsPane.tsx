import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useToggle } from 'react-use';

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
import { t, Trans } from '@grafana/i18n';
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
import { Button, FilterInput, ScrollContainer, Stack, ToolbarButton, useStyles2, Text } from '@grafana/ui';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

import { PanelOptions } from './PanelOptions';
import { PanelVizTypePicker } from './PanelVizTypePicker';
import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './interaction';
import { useScrollReflowLimit } from './useScrollReflowLimit';

export interface PanelOptionsPaneState extends SceneObjectState {
  isVizPickerOpen?: boolean;
  searchQuery: string;
  listMode: OptionFilter;
  panelRef: SceneObjectRef<VizPanel>;
  isNewPanel?: boolean;
  hasPickedViz?: boolean;
}

interface PluginOptionsCache {
  options: DeepPartial<{}>;
  fieldConfig: FieldConfigSource<DeepPartial<{}>>;
}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  private _cachedPluginOptions: Record<string, PluginOptionsCache | undefined> = {};

  onToggleVizPicker = () => {
    const newState = !this.state.isVizPickerOpen;
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.TOGGLE_DROPDOWN,
      open: newState,
    });
    this.setState({
      isVizPickerOpen: newState,
      hasPickedViz: this.state.hasPickedViz || newState === false,
    });
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
      const fieldConfigWithOverrides = {
        ...options.fieldConfig,
        overrides: newFieldConfig.overrides,
      };
      panel.onFieldConfigChange(fieldConfigWithOverrides, true);
    }

    // Handle preview suggestions
    if (!options.withModKey) {
      this.onToggleVizPicker();
    }
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

  static Component = PanelOptionsPaneComponent;
}

function PanelOptionsPaneComponent({ model }: SceneComponentProps<PanelOptionsPane>) {
  const { isVizPickerOpen, searchQuery, listMode, panelRef, isNewPanel, hasPickedViz } = model.useState();
  const panel = panelRef.resolve();
  const { pluginId } = panel.useState();
  const { data } = sceneGraph.getData(panel).useState();
  const styles = useStyles2(getStyles);
  const isSearching = searchQuery.length > 0;
  const hasFieldConfig = !isSearching && !panel.getPlugin()?.fieldConfigRegistry.isEmpty();
  const [isSearchingOptions, setIsSearchingOptions] = useToggle(false);
  const onlyOverrides = listMode === OptionFilter.Overrides;
  const isScrollingLayout = useScrollReflowLimit();

  const pluginMeta: PanelPluginMeta = useMemo(() => {
    let meta = getAllPanelPluginMeta().filter((p) => p.id === pluginId)[0];
    if (!meta) {
      const notFound = getPanelPluginNotFound(`Panel plugin not found (${pluginId})`, true);
      meta = notFound.meta;
    }
    return meta;
  }, [pluginId]);

  return (
    <>
      {!isVizPickerOpen && (
        <>
          <div className={styles.top}>
            <Stack gap={1}>
              <img alt={pluginMeta.name} src={pluginMeta.info.logos.small} className={styles.pluginIcon} />
              <Text
                data-testid={selectors.components.PanelEditor.OptionsPane.header}
                element="h3"
                variant="body"
                weight="medium"
                truncate
              >
                {pluginMeta.name}
              </Text>
              <Button
                size="sm"
                fill="text"
                onClick={model.onToggleVizPicker}
                data-testid={selectors.components.PanelEditor.toggleVizPicker}
                aria-label={t(
                  'dashboard-scene.visualization-button.aria-label-change-visualization',
                  'Change visualization'
                )}
              >
                <Trans i18nKey="dashboard-scene.visualization-button.text">Change</Trans>
              </Button>
            </Stack>
            <Stack gap={1}>
              {hasFieldConfig && (
                <ToolbarButton
                  icon="sliders-v-alt"
                  tooltip={t('dashboard.panel-edit.only-overrides-button-tooltip', 'Show only overrides')}
                  variant={onlyOverrides ? 'active' : 'canvas'}
                  onClick={() => {
                    model.onSetListMode(onlyOverrides ? OptionFilter.All : OptionFilter.Overrides);
                  }}
                />
              )}
              <Button
                icon="search"
                variant="secondary"
                onClick={setIsSearchingOptions}
                tooltip={t('dashboard.panel-edit.visualization-button-tooltip', 'Search options')}
              />
            </Stack>
          </div>
          {isSearchingOptions && (
            <div className={styles.searchWrapper}>
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
            </div>
          )}
          <ScrollContainer minHeight={isScrollingLayout ? 'max-content' : 0}>
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
          showBackButton={config.featureToggles.newVizSuggestions ? hasPickedViz || !isNewPanel : true}
        />
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    top: css({
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(1, 2),
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    searchOptions: css({
      minHeight: theme.spacing(4),
    }),
    searchWrapper: css({
      padding: theme.spacing(1, 2, 2, 2),
    }),
    rotateIcon: css({
      rotate: '180deg',
    }),
    pluginIcon: css({
      height: '22px',
      width: '22px',
    }),
  };
}
