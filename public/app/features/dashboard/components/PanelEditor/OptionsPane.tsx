import React from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { useStyles } from '@grafana/ui';
import { css } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { VisualizationButton } from './VisualizationButton';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types';

interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  width: number;
  dashboard: DashboardModel;
  onClose: () => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}

export const OptionsPane: React.FC<Props> = ({
  plugin,
  panel,
  width,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  onClose,
  dashboard,
}: Props) => {
  const styles = useStyles(getStyles);
  const isVizPickerOpen = useSelector((state: StoreState) => state.panelEditor.isVizPickerOpen);

  return (
    <div className={styles.wrapper} aria-label={selectors.components.PanelEditor.OptionsPane.content}>
      <div className={styles.panelOptionsPane}>
        <div className={styles.vizButtonWrapper}>
          <VisualizationButton panel={panel} />
        </div>

        {!isVizPickerOpen && (
          <OptionsPaneOptions
            panel={panel}
            dashboard={dashboard}
            plugin={plugin}
            onClose={onClose}
            onFieldConfigsChange={onFieldConfigsChange}
            onPanelOptionsChanged={onPanelOptionsChanged}
            onPanelConfigChange={onPanelConfigChange}
          />
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      height: 100%;
      width: 100%;
      display: flex;
    `,
    panelOptionsPane: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.md} ${theme.spacing.sm} 0 0;
      flex-grow: 1;
    `,
    paneBg: css`
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
      flex-grow: 1;
    `,
    vizButtonWrapper: css`
      padding: 0 0 ${theme.spacing.md} 0;
    `,
    legacyOptions: css`
      label: legacy-options;
      .panel-options-grid {
        display: flex;
        flex-direction: column;
      }
      .panel-options-group {
        margin-bottom: 0;
      }
      .panel-options-group__body {
        padding: ${theme.spacing.md} 0;
      }

      .section {
        display: block;
        margin: ${theme.spacing.md} 0;

        &:first-child {
          margin-top: 0;
        }
      }
    `,
  };
};
