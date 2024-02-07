import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { ButtonGroup, FilterInput, RadioButtonGroup, ToolbarButton, useStyles2 } from '@grafana/ui';
import { OptionFilter, renderSearchHits } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getFieldOverrideCategories } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';
import { getPanelFrameCategory2 } from 'app/features/dashboard/components/PanelEditor/getPanelFrameOptions';
import { getVisualizationOptions2 } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

import { PanelVizTypePicker } from './PanelVizTypePicker';
import { VizPanelManager } from './VizPanelManager';

export interface PanelOptionsPaneState extends SceneObjectState {}

export class PanelOptionsPane extends SceneObjectBase<PanelOptionsPaneState> {
  public panelManager: VizPanelManager;

  public constructor(panelMgr: VizPanelManager) {
    super({});

    this.panelManager = panelMgr;
  }

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { panelManager } = model;
    const { panel } = panelManager.state;
    const dataObject = sceneGraph.getData(panel);
    const rawData = dataObject.useState();
    const dataWithFieldConfig = panel.applyFieldConfig(rawData.data!);
    const { pluginId, options, fieldConfig } = panel.useState();
    const styles = useStyles2(getStyles);
    const [isVizPickerOpen, setVizPickerOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const panelFrameOptions = useMemo(() => getPanelFrameCategory2(panel), [panel]);
    const [listMode, setListMode] = useState(OptionFilter.All);

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
          dataWithFieldConfig.series,
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

    return (
      <div className={styles.wrapper}>
        {!isVizPickerOpen && (
          <VisualizationButton
            pluginId={pluginId}
            onClick={() => {
              setVizPickerOpen(true);
            }}
          />
        )}
        <div className={styles.box}>
          {isVizPickerOpen && (
            <PanelVizTypePicker panelManager={panelManager} onChange={() => setVizPickerOpen(false)} />
          )}
          {!isVizPickerOpen && (
            <>
              <div className={styles.top}>
                <FilterInput
                  className={styles.searchOptions}
                  value={searchQuery}
                  placeholder="Search options"
                  onChange={setSearchQuery}
                />
                {!isSearching && (
                  <RadioButtonGroup
                    options={[
                      { label: 'All', value: OptionFilter.All },
                      { label: 'Overrides', value: OptionFilter.Overrides },
                    ]}
                    value={listMode}
                    onChange={setListMode}
                    fullWidth
                  ></RadioButtonGroup>
                )}
              </div>
              <div className={styles.mainBox}>{mainBoxElements}</div>
            </>
          )}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    top: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1),
      gap: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderBottom: 'none',
      borderTopLeftRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
    box: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '1',
      background: theme.colors.background.primary,
      overflow: 'hidden',
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: '1',
      gap: theme.spacing(2),
    }),
    mainBox: css({
      flexGrow: 1,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.components.panel.borderColor}`,
      borderTop: 'none',
      overflow: 'auto',
    }),
    searchOptions: css({
      minHeight: theme.spacing(4),
    }),
  };
}

export const VisualizationButton = ({ pluginId, onClick }: { pluginId: string; onClick: () => void }) => {
  // const dispatch = useDispatch();
  // const plugin = useSelector(getPanelPluginWithFallback(panel.type));
  // const isPanelOptionsVisible = useSelector((state) => state.panelEditor.ui.isPanelOptionsVisible);
  // const isVizPickerOpen = useSelector((state) => state.panelEditor.isVizPickerOpen);

  // const onToggleOpen = () => {
  //   dispatch(toggleVizPicker(!isVizPickerOpen));
  // };

  // const onToggleOptionsPane = () => {
  //   dispatch(updatePanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible }));
  // };

  // if (!plugin) {
  //   return null;
  // }

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
          onClick={onClick}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label="Change Visualization"
          variant="canvas"
          fullWidth
        >
          {pluginMeta.name}
        </ToolbarButton>
        {/* <ToolbarButton
          tooltip={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
          icon={isPanelOptionsVisible ? 'angle-right' : 'angle-left'}
          onClick={onToggleOptionsPane}
          variant="canvas"
          data-testid={selectors.components.PanelEditor.toggleVizOptions}
          aria-label={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
        /> */}
      </ButtonGroup>
    </div>
  );
};

function getVizButtonStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(2),
    }),
    vizButton: css({
      textAlign: 'left',
    }),
  };
}
