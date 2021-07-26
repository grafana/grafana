import React from 'react';
import { Label, stylesFactory } from '@grafana/ui';
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
  if (!color) {
    return (
      <></>
    )
  }
  const colorMode = getFieldColorModeForField(color!.field!);
  const colors = colorMode.getColors!(config.theme2)
  const style = getStyles(config.theme, colors);
  if (!color.field && color.fixed) {
    return <div className={style.infoWrap}>Fixed: {color.fixed}</div>;
  }

  const fmt = (v: any) => `${formattedValueToString(color.field!.display!(v))}`;
  
  if (colorMode.isContinuous && colorMode.getColors) {
    const colorRange = getMinMaxAndDelta(color.field!)
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

    return <>
    <Label>{color?.field?.name}</Label>
    <div className={style.gradientContainer}>
      <div>{fmt(colorRange.min)}</div>
      <div>{fmt(colorRange.max)}</div>
    </div>
    </>
  }

  const thresholds = color.field?.config?.thresholds;
  if (!thresholds) {
    return <div className={style.infoWrap}>no thresholds????</div>;
  }

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

const getStyles = stylesFactory((theme: GrafanaTheme, colors) => ({
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
    background-image: linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]});
  `
}));
