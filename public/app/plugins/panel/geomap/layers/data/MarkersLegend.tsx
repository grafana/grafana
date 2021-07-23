import React from 'react';
import { stylesFactory } from '@grafana/ui';
import { formattedValueToString, getFieldColorModeForField, GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { DimensionSupplier } from '../../dims/types';
import { getMinMaxAndDelta } from '../../../../../../../packages/grafana-data/src/field/scale'; 

export interface MarkersLegendProps {
  color?: DimensionSupplier<string>;
  size?: DimensionSupplier<number>;
}
export function MarkersLegend(props: MarkersLegendProps) {
  const { color } = props;
  const style = getStyles(config.theme);
  if (!color) {
    return (
      <></>
    )
  }
  if (!color.field && color.fixed) {
    return <div className={style.infoWrap}>Fixed: {color.fixed}</div>;
  }
  const colorMode = getFieldColorModeForField(color.field!);
  const colorRange = getMinMaxAndDelta(color.field!)
  if (colorMode.isContinuous && colorMode.getColors) {
    // getColors return an array of color string from the color scheme chosen
    const colors = colorMode.getColors(config.theme2);
    //TODO: can we get the same gradiant scale img as the option dropdown?
    return <div className={style.gradientContainer}>
      <div className={style.minVal}>{colorRange.min}</div>
      <div className={style.minVal}>{colorRange.max}</div>
    </div>
  }

  const thresholds = color.field?.config?.thresholds;
  if (!thresholds) {
    return <div className={style.infoWrap}>no thresholds????</div>;
  }

  const fmt = (v: any) => `${formattedValueToString(color.field!.display!(v))}`;
  return (
    <div className={style.infoWrap}>
      {thresholds && (
        <div className={style.legend}>
          {thresholds.steps.map((step:any, idx:number) => {
            const next = thresholds!.steps[idx + 1];
            let info = <span>?</span>;
            if (idx === 0) {
              info = <span>&lt; {fmt(next.value)}</span>;
            } else if (next) {
              info = (
                <span>
                  {fmt(step.value)} - {fmt(next.value)}
                </span>
              );
            } else {
              info = <span>{fmt(step.value)} +</span>;
            }
            return (
              <div key={`${idx}/${step.value}`} className={style.legendItem}>
                <i style={{ background: config.theme2.visualization.getColorByName(step.color) }}></i>
                {info}
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    color: #999;
    background: #CCCC;
    border-radius: 2px;
    padding: 8px;
  `,
  legend: css`
    line-height: 18px;
    color: #555;
    display: flex;
    flex-direction: column;

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
    background-image: linear-gradient(to right, green, red);
  `,
  minVal: css `
    width: 10%;
  `,
  maxVal: css `
    width: 10%;
  `
}));
