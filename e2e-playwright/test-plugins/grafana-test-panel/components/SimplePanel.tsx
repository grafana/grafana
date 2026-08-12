import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { PanelDataErrorView } from '@grafana/runtime';
import { PanelProps } from '@grafana/data';
import React from 'react';
import { SimpleOptions } from '../types';
import { Trans } from '@grafana/i18n';

interface Props extends PanelProps<SimpleOptions> {}

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
};

export const SimplePanel: React.FC<Props> = ({ options, data, width, height, fieldConfig, id }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <svg
        className={styles.svg}
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox={`-${width / 2} -${height / 2} ${width} ${height}`}
      >
        <g>
          <circle data-testid="simple-panel-circle" style={{ fill: theme.colors.primary.main }} r={100} />
        </g>
      </svg>

      <div className={styles.textBox}>
        {options.showSeriesCount && (
          <div data-testid="simple-panel-series-counter">
            <Trans
              i18nKey="components.simplePanel.options.showSeriesCount"
              defaults="Number of series: {{numberOfSeries}}"
              values={{ numberOfSeries: data.series.length }}
            />
          </div>
        )}
        <div>
          <Trans
            i18nKey="components.simplePanel.options.textOptionValue"
            defaults="Text option value: {{optionValue}}"
            values={{ optionValue: options.text }}
          />
        </div>
      </div>
    </div>
  );
};
