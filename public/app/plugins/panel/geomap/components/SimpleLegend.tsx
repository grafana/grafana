import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { FieldType, formattedValueToString, GrafanaTheme, PanelData, ThresholdsConfig } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';

interface Props {
  txt: string;
  data?: PanelData;
}

interface State {}

export class SimpleLegend extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = {};
  }

  render() {
    let fmt = (v: any) => `${v}`;
    let thresholds: ThresholdsConfig | undefined;
    const series = this.props.data?.series;
    if (series) {
      for (const frame of series) {
        for (const field of frame.fields) {
          if (field.type === FieldType.number && field.config.thresholds) {
            thresholds = field.config.thresholds;
            fmt = (v: any) => `${formattedValueToString(field.display!(v))}`;
            break;
          }
        }
      }
    }

    return (
      <div className={this.style.infoWrap}>
        <div>{this.props.txt}</div>
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
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
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
