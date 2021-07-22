import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { formattedValueToString, getFieldColorModeForField, GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { DimensionSupplier } from '../../dims/types';

export interface MarkersLegendProps {
  color?: DimensionSupplier<string>;
  size?: DimensionSupplier<number>;
}

export class MarkersLegend extends PureComponent<MarkersLegendProps> {
  style = getStyles(config.theme);

  constructor(props: MarkersLegendProps) {
    super(props);
    this.state = {};
  }

  render() {
    const { color } = this.props;
    console.log( 'MarkersLegend: FIELD color', color?.field );

    if (!color) {
      return <></>;
    }

    if (!color.field && color.fixed) {
      return <div className={this.style.infoWrap}>Fixed: {color.fixed}</div>;
    }

    const colorMode = getFieldColorModeForField(color.field!);
    if (colorMode.isContinuous && colorMode.getColors) {
      return <div className={this.style.infoWrap}>Color scale</div>;
    }

    const thresholds = color.field?.config?.thresholds;
    if (!thresholds) {
      return <div className={this.style.infoWrap}>no thresholds????</div>;
    }

    const fmt = (v: any) => `${formattedValueToString(color.field!.display!(v))}`;
    return (
      <div className={this.style.infoWrap}>
        {thresholds && (
          <div className={this.style.legend}>
            {thresholds.steps.map((step, idx) => {
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
                <div key={`${idx}/${step.value}`} className={this.style.legendItem}>
                  <i style={{ background: config.theme2.visualization.getColorByName(step.color) }}></i>
                  {info}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
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
}));
