import { css } from '@emotion/css';

import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton, ButtonGroup } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useDispatch, useSelector } from 'app/types';

import { PanelModel } from '../../state/PanelModel';
import { getPanelPluginWithFallback } from '../../state/selectors';

import { updatePanelEditorUIState } from './state/actions';
import { toggleVizPicker } from './state/reducers';

type Props = {
  panel: PanelModel;
};

export const VisualizationButton = ({ panel }: Props) => {
  const dispatch = useDispatch();
  const plugin = useSelector(getPanelPluginWithFallback(panel.type));
  const isPanelOptionsVisible = useSelector((state) => state.panelEditor.ui.isPanelOptionsVisible);
  const isVizPickerOpen = useSelector((state) => state.panelEditor.isVizPickerOpen);

  const onToggleOpen = () => {
    dispatch(toggleVizPicker(!isVizPickerOpen));
  };

  const onToggleOptionsPane = () => {
    dispatch(updatePanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible }));
  };

  if (!plugin) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <ButtonGroup>
        <ToolbarButton
          className={styles.vizButton}
          tooltip={t(
            'dashboard.visualization-button.tooltip-click-to-change-visualization',
            'Click to change visualization'
          )}
          imgSrc={plugin.meta.info.logos.small}
          isOpen={isVizPickerOpen}
          onClick={onToggleOpen}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label={t('dashboard.visualization-button.aria-label-change-visualization', 'Change visualization')}
          variant="canvas"
          fullWidth
        >
          {plugin.meta.name}
        </ToolbarButton>
        <ToolbarButton
          tooltip={
            isPanelOptionsVisible
              ? t('dashboard.visualization-button.tooltip-close', 'Close options pane')
              : t('dashboard.visualization-button.tooltip-show', 'Show options pane')
          }
          icon={isPanelOptionsVisible ? 'angle-right' : 'angle-left'}
          onClick={onToggleOptionsPane}
          variant="canvas"
          data-testid={selectors.components.PanelEditor.toggleVizOptions}
          aria-label={
            isPanelOptionsVisible
              ? t('dashboard.visualization-button.aria-label-close', 'Close options pane')
              : t('dashboard.visualization-button.aria-label-show', 'Show options pane')
          }
        />
      </ButtonGroup>
    </div>
  );
};

VisualizationButton.displayName = 'VisualizationTab';

const styles = {
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  vizButton: css({
    textAlign: 'left',
  }),
};
