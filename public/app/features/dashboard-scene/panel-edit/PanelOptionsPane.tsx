import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { FilterInput, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import { getPanelFrameCategory2 } from 'app/features/dashboard/components/PanelEditor/getPanelFrameOptions';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

import { PanelEditor } from './PanelEditor';
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

  public getVizManager() {
    return sceneGraph.getAncestor(this, PanelEditor).state.vizManager;
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

  onCollapsePane = () => {
    const editor = sceneGraph.getAncestor(this, PanelEditor);
    editor.toggleOptionsPane();
  };

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { isVizPickerOpen, searchQuery, listMode } = model.useState();
    const panelManager = model.getVizManager();
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
        renderSearchHits([panelFrameOptions, ...(visualizationOptions ?? [])], justOverrides, searchQuery)
      );
    } else {
      switch (listMode) {
        case OptionFilter.All:
          mainBoxElements.push(panelFrameOptions.render());

          for (const item of visualizationOptions ?? []) {
            mainBoxElements.push(item.render());
          }

          for (const item of justOverrides) {
            mainBoxElements.push(item.render());
          }
          break;
        case OptionFilter.Overrides:
          for (const item of justOverrides) {
            mainBoxElements.push(item.render());
          }
        default:
          break;
      }
    }

    // {isVizPickerOpen && (
    //   <PanelVizTypePicker panelManager={panelManager} onChange={model.onToggleVizPicker} data={data} />
    // )}

    return (
      <div className={styles.pane}>
        {!isVizPickerOpen && (
          <>
            <div className={styles.top}>
              <VisualizationButton
                pluginId={pluginId}
                onOpen={model.onToggleVizPicker}
                isOpen={isVizPickerOpen}
                onTogglePane={model.onCollapsePane}
              />
              <FilterInput
                className={styles.searchOptions}
                value={searchQuery}
                placeholder="Search options"
                onChange={model.onSetSearchQuery}
              />
            </div>
            <div className={styles.listOfOptions}>{mainBoxElements}</div>
          </>
        )}
        {isVizPickerOpen && (
          <PanelVizTypePicker panelManager={panelManager} onChange={model.onToggleVizPicker} data={data} />
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    pane: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '1',
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
    }),
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
      <ToolbarButton
        tooltip={'Show options pane'}
        icon={'arrow-to-right'}
        onClick={onTogglePane}
        variant="canvas"
        data-testid={selectors.components.PanelEditor.toggleVizOptions}
        aria-label={'Show options pane'}
      />
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
