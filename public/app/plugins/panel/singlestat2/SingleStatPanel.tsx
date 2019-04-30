// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { config } from 'app/core/config';
import { getFlotPairs } from '@grafana/ui/src/utils/flotPairs';

// Components
import { VizRepeater } from '@grafana/ui/src/components';
import { BigValueSparkline, BigValue } from '@grafana/ui/src/components/BigValue/BigValue';

// Types
import { SingleStatOptions } from './types';
import {
  DisplayValue,
  PanelProps,
  getDisplayProcessor,
  NullValueMode,
  FieldType,
  calculateStats,
  getFirstTimeField,
} from '@grafana/ui';

interface SingleStatDisplay {
  value: DisplayValue;
  prefix?: DisplayValue;
  suffix?: DisplayValue;
  sparkline?: BigValueSparkline;
  backgroundColor?: string;
}

export class SingleStatPanel extends PureComponent<PanelProps<SingleStatOptions>> {
  renderValue = (value: SingleStatDisplay, width: number, height: number): JSX.Element => {
    return <BigValue {...value} width={width} height={height} theme={config.theme} />;
  };

  getValues = (): SingleStatDisplay[] => {
    const { data, replaceVariables, options, timeRange } = this.props;
    const { valueOptions, valueMappings } = options;

    const display = getDisplayProcessor({
      unit: valueOptions.unit,
      decimals: valueOptions.decimals,
      mappings: valueMappings,
      thresholds: options.thresholds,
      theme: config.theme,
    });

    const { colorBackground, colorValue, colorPrefix, colorPostfix, sparkline } = options;
    const { stat } = valueOptions;

    const values: SingleStatDisplay[] = [];
    for (const series of data.series) {
      const timeColumn = sparkline.show ? getFirstTimeField(series) : -1;

      for (let i = 0; i < series.fields.length; i++) {
        const field = series.fields[i];

        // Show all fields that are not 'time'
        if (field.type === FieldType.number) {
          const stats = calculateStats({
            series,
            fieldIndex: i,
            stats: [stat], // The stats to calculate
            nullValueMode: NullValueMode.Null,
          });

          const v: SingleStatDisplay = {
            value: display(stats[stat]),
          };
          v.value.title = replaceVariables(field.name);

          const color = v.value.color;
          if (!colorValue) {
            delete v.value.color;
          }

          if (colorBackground) {
            v.backgroundColor = color;
          }

          if (options.valueFontSize) {
            v.value.fontSize = options.valueFontSize;
          }

          if (valueOptions.prefix) {
            v.prefix = {
              text: replaceVariables(valueOptions.prefix),
              numeric: NaN,
              color: colorPrefix ? color : null,
              fontSize: options.prefixFontSize,
            };
          }
          if (valueOptions.suffix) {
            v.suffix = {
              text: replaceVariables(valueOptions.suffix),
              numeric: NaN,
              color: colorPostfix ? color : null,
              fontSize: options.postfixFontSize,
            };
          }

          if (sparkline.show && timeColumn >= 0) {
            const points = getFlotPairs({
              series,
              xIndex: timeColumn,
              yIndex: i,
              nullValueMode: NullValueMode.Null,
            });

            v.sparkline = {
              ...sparkline,
              data: points,
              minX: timeRange.from.valueOf(),
              maxX: timeRange.to.valueOf(),
            };
          }

          values.push(v);
        }
      }
    }

    if (values.length === 0) {
      values.push({
        value: {
          numeric: 0,
          text: 'No data',
        },
      });
    } else if (values.length === 1) {
      // Don't show title for single item
      values[0].value.title = null;
    }
    return values;
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <VizRepeater
        getValues={this.getValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
