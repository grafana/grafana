import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { FilterInput, Stack, ToolbarButton, useStyles2 } from '@grafana/ui';
import { OptionFilter } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

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

  onCollapsePane = () => {
    const editor = sceneGraph.getAncestor(this, PanelEditor);
    editor.toggleOptionsPane();
  };

  static Component = ({ model }: SceneComponentProps<PanelOptionsPane>) => {
    const { isVizPickerOpen, searchQuery, listMode } = model.useState();
    const editor = sceneGraph.getAncestor(model, PanelEditor);
    const { optionsCollapsed, vizManager } = editor.useState();
    const { pluginId } = vizManager.state.panel.useState();
    const styles = useStyles2(getStyles);

    if (optionsCollapsed) {
      return (
        <div className={styles.pane}>
          <div className={styles.top}>
            <ToolbarButton
              tooltip={'Open options pane'}
              icon={'arrow-to-right'}
              onClick={model.onCollapsePane}
              variant="canvas"
              className={styles.rotateIcon}
              data-testid={selectors.components.PanelEditor.toggleVizOptions}
              aria-label={'Open options pane'}
            />
          </div>
        </div>
      );
    }

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
            <div className={styles.listOfOptions}>
              <PanelOptions vizManager={vizManager} searchQuery={searchQuery} listMode={listMode} />
            </div>
          </>
        )}
        {isVizPickerOpen && <PanelVizTypePicker vizManager={vizManager} onChange={model.onToggleVizPicker} />}
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
    rotateIcon: css({
      rotate: '180deg',
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
      {/* <ToolbarButton
        tooltip={'Close options pane'}
        icon={'arrow-to-right'}
        onClick={onTogglePane}
        variant="canvas"
        data-testid={selectors.components.PanelEditor.toggleVizOptions}
        aria-label={'Close options pane'}
      /> */}
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
