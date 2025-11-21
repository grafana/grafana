import { css } from '@emotion/css';
import React, { memo } from 'react';

import { colorManipulator, FieldConfig, FieldSparkline, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/schema';

import { useStyles2 } from '../../themes/ThemeContext';
import { Themeable2 } from '../../types/theme';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { UPlotChart } from '../uPlot/Plot';
import { preparePlotData2, getStackingGroups } from '../uPlot/utils';

import { prepareSeries, prepareConfig } from './utils';

export interface SparklineProps extends Themeable2 {
  width: number;
  height: number;
  config?: FieldConfig<GraphFieldConfig>;
  sparkline: FieldSparkline;
}

const CompactAlert = ({ children, width }: { width: number; children: string | React.ReactElement }) => {
  const styles = useStyles2(getCompactAlertStyles);

  return (
    <div role="alert" style={{ width, display: 'flex', justifyContent: 'center' }}>
      {width >= 400 ? (
        <div role="alert" className={styles.content}>
          <Icon className={styles.icon} name="exclamation-triangle" />
          {children}
        </div>
      ) : (
        <Tooltip content={children} placement="top">
          <div className={styles.content}>
            <Icon className={styles.icon} size="lg" name="exclamation-triangle" />
            <Trans i18nKey="grafana-ui.components.sparkline.alert.title">Cannot render sparkline</Trans>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

const getCompactAlertStyles = (theme: GrafanaTheme2) => ({
  content: css({
    margin: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    padding: theme.spacing(0.5, 1),
    color: theme.colors.warning.contrastText,
    background: colorManipulator.alpha(theme.colors.warning.main, 0.85),
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    justifyContent: 'center',

    '& a': {
      color: theme.colors.warning.contrastText,
      textDecoration: 'underline',
      '&:hover': {
        textDecoration: 'none',
      },
    },
  }),
  icon: css({
    marginRight: theme.spacing(1),
  }),
});

export const Sparkline: React.FC<SparklineProps> = memo((props) => {
  const { sparkline, config: fieldConfig, theme, width, height } = props;

  const { frame: alignedDataFrame, warning } = prepareSeries(sparkline, fieldConfig);
  if (warning) {
    return <CompactAlert width={width}>{warning}</CompactAlert>;
  }

  const data = preparePlotData2(alignedDataFrame, getStackingGroups(alignedDataFrame));
  const configBuilder = prepareConfig(sparkline, alignedDataFrame, theme);

  return <UPlotChart data={data} config={configBuilder} width={width} height={height} />;
});

Sparkline.displayName = 'Sparkline';
