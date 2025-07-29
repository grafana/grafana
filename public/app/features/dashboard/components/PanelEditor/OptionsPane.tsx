import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { OptionsPaneOptions } from './OptionsPaneOptions';
import { VisualizationButton } from './VisualizationButton';
import { VisualizationSelectPane } from './VisualizationSelectPane';
import { OptionPaneRenderProps } from './types';
import { usePanelLatestData } from './usePanelLatestData';

export const OptionsPane = ({
  plugin,
  panel,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  dashboard,
  instanceState,
}: OptionPaneRenderProps) => {
  const styles = useStyles2(getStyles);
  const isVizPickerOpen = useSelector((state) => state.panelEditor.isVizPickerOpen);
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, true);

  return (
    <div className={styles.wrapper} data-testid={selectors.components.PanelEditor.OptionsPane.content}>
      {!isVizPickerOpen && (
        <>
          <div className={styles.vizButtonWrapper}>
            <VisualizationButton panel={panel} />
          </div>
          <div className={styles.optionsWrapper}>
            <OptionsPaneOptions
              panel={panel}
              dashboard={dashboard}
              plugin={plugin}
              instanceState={instanceState}
              data={data}
              onFieldConfigsChange={onFieldConfigsChange}
              onPanelOptionsChanged={onPanelOptionsChanged}
              onPanelConfigChange={onPanelConfigChange}
            />
          </div>
        </>
      )}
      {isVizPickerOpen && <VisualizationSelectPane panel={panel} data={data} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      height: '100%',
      width: '100%',
      display: 'flex',
      flex: '1 1 0',
      flexDirection: 'column',
      padding: 0,
    }),
    optionsWrapper: css({
      flexGrow: 1,
      minHeight: 0,
    }),
    vizButtonWrapper: css({
      padding: `0 ${theme.spacing(2, 2)} 0`,
    }),
    legacyOptions: css({
      label: 'legacy-options',
      '.panel-options-grid': {
        display: 'flex',
        flexDirection: 'column',
      },
      '.panel-options-group': {
        marginBottom: 0,
      },
      '.panel-options-group__body': {
        padding: `${theme.spacing(2)} 0`,
      },
      '.section': {
        display: 'block',
        margin: `${theme.spacing(2)} 0`,
        '&:first-child': {
          marginTop: 0,
        },
      },
    }),
  };
};
