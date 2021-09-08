import React from 'react';
import { Label, stylesFactory, useTheme2, VizLegendItem } from '@grafana/ui';
import { formattedValueToString, getFieldColorModeForField, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { DimensionSupplier } from 'app/features/dimensions';
import { getThresholdItems } from 'app/plugins/panel/state-timeline/utils';
import { getMinMaxAndDelta } from '../../../../../../../packages/grafana-data/src/field/scale';

export interface MarkersLegendProps {
  color?: DimensionSupplier<string>;
  size?: DimensionSupplier<number>;
}

export function MarkersLegend(props: MarkersLegendProps) {
  const { color } = props;
  const theme = useTheme2();

  if (!color || (!color.field && color.fixed)) {
    return <></>;
  }

  const style = getStyles(theme);
  const fmt = (v: any) => `${formattedValueToString(color.field!.display!(v))}`;
  const colorMode = getFieldColorModeForField(color!.field!);

  if (colorMode.isContinuous && colorMode.getColors) {
    const colors = colorMode.getColors(config.theme2);
    const colorRange = getMinMaxAndDelta(color.field!);
    // TODO: explore showing mean on the gradiant scale
    // const stats = reduceField({
    //   field: color.field!,
    //   reducers: [
    //     ReducerID.min,
    //     ReducerID.max,
    //     ReducerID.mean,
    //     // std dev?
    //   ]
    // })

    return (
      <>
        <Label>{color?.field?.name}</Label>
        <div
          className={style.gradientContainer}
          style={{ backgroundImage: `linear-gradient(to right, ${colors.map((c) => c).join(', ')}` }}
        >
          <div style={{ color: theme.colors.getContrastText(colors[0]) }}>{fmt(colorRange.min)}</div>
          <div style={{ color: theme.colors.getContrastText(colors[colors.length - 1]) }}>{fmt(colorRange.max)}</div>
        </div>
      </>
    );
  }

  const thresholds = color.field?.config?.thresholds;
  if (!thresholds || thresholds.steps.length < 2) {
    return <div></div>; // don't show anything in the legend
  }

  const items = getThresholdItems(color.field!.config, config.theme2);
  return (
    <div className={style.infoWrap}>
      <div className={style.legend}>
        {items.map((item: VizLegendItem, idx: number) => (
          <div key={`${idx}/${item.label}`} className={style.legendItem}>
            <i style={{ background: item.color }}></i>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  infoWrap: css`
    background: ${theme.colors.background.secondary};
    border-radius: 2px;
    padding: ${theme.spacing(1)};
  `,
  legend: css`
    line-height: 18px;
    display: flex;
    flex-direction: column;
    font-size: ${theme.typography.bodySmall.fontSize};

    i {
      width: 18px;
      height: 18px;
      float: left;
      margin-right: 8px;
      opacity: 0.7;
    }
  `,
  legendItem: css`
    white-space: nowrap;
  `,
  gradientContainer: css`
    min-width: 200px;
    display: flex;
    justify-content: space-between;
    font-size: ${theme.typography.bodySmall.fontSize};
    padding: ${theme.spacing(0, 0.5)};
  `,
}));
