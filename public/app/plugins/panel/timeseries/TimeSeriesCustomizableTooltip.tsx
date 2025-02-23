import { css } from '@emotion/css';

import { DataFrame, formattedValueToString, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VizCustomizableFooterTooltip } from '@grafana/ui/src/components/VizTooltip/VizCustomizableFooterTooltip';
import { VizCustomizableHeaderTooltip } from '@grafana/ui/src/components/VizTooltip/VizCustomizableHeaderTooltip';

export interface TimeSeriesCustomizableTooltipProps {
  // aligned series frame
  series: DataFrame;
  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  dataLinks: LinkModel[];
}

export const TimeSeriesCustomizableTooltip = ({ series, dataIdxs, dataLinks }: TimeSeriesCustomizableTooltipProps) => {
  const styles = useStyles2(getStyles);

  const xField = series.fields[0];
  const xVal = formattedValueToString(xField.display!(xField.values[dataIdxs[0]!]));
  const headerValue = xField.config.custom?.hideFrom?.tooltip ? { value: '' } : { value: xVal };

  return (
    <div className={styles.wrapper}>
      {headerValue != null && <VizCustomizableHeaderTooltip value={headerValue.value} />}
      <VizCustomizableFooterTooltip dataLinks={dataLinks} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
