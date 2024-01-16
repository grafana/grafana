import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ButtonGroup, FilterInput, RadioButtonGroup, ToolbarButton, useStyles2 } from '@grafana/ui';
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
    const { pluginId } = panel.useState();
    const styles = useStyles2(getStyles);
    const [isVizPickerOpen, setVizPickerOpen] = useState(true);

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
              <FilterInput value={''} placeholder="Search options" onChange={() => {}} />
              <RadioButtonGroup
                options={[
                  { label: 'All', value: 'All' },
                  { label: 'Overrides', value: 'Overrides' },
                ]}
                value={'All'}
                fullWidth
              ></RadioButtonGroup>
              {/* <OptionsPaneCategory id="test" title="Panel options">
                Placeholder
              </OptionsPaneCategory> */}
            </>
          )}
        </div>
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
      padding: theme.spacing(1),
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      gap: theme.spacing(1),
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      flexGrow: '1',
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
