import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Box, ButtonGroup, FilterInput, RadioButtonGroup, ToolbarButton, useStyles2 } from '@grafana/ui';
import { OptionFilter, RenderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import { getPanelFrameCategory2 } from 'app/features/dashboard/components/PanelEditor/getPanelFrameOptions';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

import { PanelVizTypePicker } from './PanelVizTypePicker';
import { VizPanelManager } from './VizPanelManager';

export interface PanelOptionsPaneState extends SceneObjectState {
  isVizPickerOpen?: boolean;
  searchQuery: string;
  listMode: OptionFilter;
}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  public panelManager: VizPanelManager;

  public constructor(panelMgr: VizPanelManager) {
    super({
      searchQuery: '',
      listMode: OptionFilter.All,
    });

    this.panelManager = panelMgr;
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

  onCollapsePane = () => {};

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { isVizPickerOpen, searchQuery, listMode } = model.useState();
    const { panelManager } = model;
    const { panel } = panelManager.state;
    const dataObject = sceneGraph.getData(panel);
    const { data } = dataObject.useState();
    const { pluginId, options, fieldConfig } = panel.useState();
    const styles = useStyles2(getStyles);
    const panelFrameOptions = useMemo(() => getPanelFrameCategory2(panel), [panel]);

    const visualizationOptions = useMemo(() => {
      const plugin = panel.getPlugin();
      if (!plugin) {
        return undefined;
      }

      return getVisualizationOptions2({
        panel,
        plugin: plugin,
        eventBus: panel.getPanelContext().eventBus,
        instanceState: panel.getPanelContext().instanceState!,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panel, options, fieldConfig]);

    const justOverrides = useMemo(
      () =>
        getFieldOverrideCategories(
          fieldConfig,
          panel.getPlugin()?.fieldConfigRegistry!,
          data?.series ?? [],
          searchQuery,
          (newConfig) => {
            panel.setState({
              fieldConfig: newConfig,
            });
          }
        ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [searchQuery, panel, fieldConfig]
    );

    const isSearching = searchQuery.length > 0;
    const mainBoxElements: React.ReactNode[] = [];

    if (isSearching) {
      mainBoxElements.push(
        <RenderSearchHits
          allOptions={[panelFrameOptions, ...(visualizationOptions ?? [])]}
          overrides={justOverrides}
          searchQuery={searchQuery}
          key="render-search-hits"
        />
      );
    } else {
      switch (listMode) {
        case OptionFilter.All:
          mainBoxElements.push(<panelFrameOptions.Render key="panel-frame-options" />);

          for (const item of visualizationOptions ?? []) {
            mainBoxElements.push(<item.Render key={item.props.id} />);
          }

          for (const item of justOverrides) {
            mainBoxElements.push(<item.Render key={item.props.id} />);
          }
          break;
        case OptionFilter.Overrides:
          for (const item of justOverrides) {
            mainBoxElements.push(<item.Render key={item.props.id} />);
          }
        default:
          break;
      }
    }

    return (
      <div className={styles.box}>
        {!isVizPickerOpen && (
          <Box paddingX={1} paddingTop={1}>
            <VisualizationButton
              pluginId={pluginId}
              onOpen={model.onToggleVizPicker}
              isOpen={isVizPickerOpen}
              onTogglePane={model.onCollapsePane}
            />
          </Box>
        )}
        {isVizPickerOpen && (
          <PanelVizTypePicker panelManager={panelManager} onChange={model.onToggleVizPicker} data={data} />
        )}
        {!isVizPickerOpen && (
          <>
            <div className={styles.top}>
              <FilterInput
                className={styles.searchOptions}
                value={searchQuery}
                placeholder="Search options"
                onChange={model.onSetSearchQuery}
              />
              {!isSearching && (
                <RadioButtonGroup
                  options={[
                    { label: 'All', value: OptionFilter.All },
                    { label: 'Overrides', value: OptionFilter.Overrides },
                  ]}
                  value={listMode}
                  onChange={model.onSetListMode}
                  fullWidth
                ></RadioButtonGroup>
              )}
            </div>
            <div className={styles.mainBox}>{mainBoxElements}</div>
          </>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    box: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '1',
      background: theme.colors.background.primary,
      overflow: 'hidden',
      border: `1px solid ${theme.colors.border.weak}`,
      borderBottom: 'none',
      borderTopLeftRadius: theme.shape.radius.default,
    }),
    top: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1),
      gap: theme.spacing(1),
    }),
    mainBox: css({
      flexGrow: 1,
      background: theme.colors.background.primary,
      overflow: 'auto',
    }),
    searchOptions: css({
      minHeight: theme.spacing(4),
    }),
  };
}

interface VisualizationButtonProps {
  pluginId: string;
  onOpen: () => void;
  isOpen?: boolean;
  onTogglePane?: () => void;
}

export function VisualizationButton({ pluginId, onOpen, isOpen, onTogglePane }: VisualizationButtonProps) {
  const styles = useStyles2(getVizButtonStyles);
  const pluginMeta = useMemo(() => getAllPanelPluginMeta().filter((p) => p.id === pluginId)[0], [pluginId]);

  return (
    <div className={styles.wrapper}>
      <ButtonGroup>
        <ToolbarButton
          className={styles.vizButton}
          tooltip="Click to change visualization"
          imgSrc={pluginMeta.info.logos.small}
          // isOpen={isVizPickerOpen}
          onClick={onOpen}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label="Change Visualization"
          variant="canvas"
          fullWidth
        >
          {pluginMeta.name}
        </ToolbarButton>
        <ToolbarButton
          tooltip={isOpen ? 'Close options pane' : 'Show options pane'}
          icon={isOpen ? 'angle-right' : 'angle-left'}
          onClick={onTogglePane}
          variant="canvas"
          data-testid={selectors.components.PanelEditor.toggleVizOptions}
          aria-label={isOpen ? 'Close options pane' : 'Show options pane'}
        />
      </ButtonGroup>
    </div>
  );
}

function getVizButtonStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    vizButton: css({
      textAlign: 'left',
    }),
  };
}
