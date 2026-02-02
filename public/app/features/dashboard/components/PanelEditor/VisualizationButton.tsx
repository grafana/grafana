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
          // BMC Change: To enable localization for below text
          tooltip={t('bmcgrafana.dashboards.edit-panel.click-to-change-visualization', 'Click to change visualization')}
          // BMC Change ends
          imgSrc={plugin.meta.info.logos.small}
          isOpen={isVizPickerOpen}
          onClick={onToggleOpen}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label="Change Visualization"
          variant="canvas"
          fullWidth
        >
          {plugin.meta.name}
        </ToolbarButton>
        <ToolbarButton
          // BMC Change: To enable localization for below text
          tooltip={
            isPanelOptionsVisible
              ? t('bmcgrafana.dashboards.edit-panel.close-options-pane', 'Close options pane')
              : t('bmcgrafana.dashboards.edit-panel.show-options-pane', 'Show options pane')
          }
          // BMC Change ends
          icon={isPanelOptionsVisible ? 'angle-right' : 'angle-left'}
          onClick={onToggleOptionsPane}
          variant="canvas"
          data-testid={selectors.components.PanelEditor.toggleVizOptions}
          // BMC Change: To enable localization for below text
          aria-label={
            isPanelOptionsVisible
              ? t('bmcgrafana.dashboards.edit-panel.close-options-pane', 'Close options pane')
              : t('bmcgrafana.dashboards.edit-panel.show-options-pane', 'Show options pane')
          }
          // BMC Change ends
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
