// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { config } from 'app/core/config';
import { getFlotPairs } from '@grafana/ui/src/utils/flotPairs';

// Components
import { ProcessedValuesRepeater } from './ProcessedValuesRepeater';

// Types
import { SingleStatOptions } from './types';
import { BigValueSparkline, BigValue } from '@grafana/ui/src/components/BigValue/BigValue';
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

  getProcessedValues = (): SingleStatDisplay[] => {
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

    for (const series of data) {
      const timeColumn = sparkline.show ? getFirstTimeField(series) : -1;

      for (let i = 0; i < series.fields.length; i++) {
        const column = series.fields[i];

        // Show all fields that are not 'time'
        if (column.type === FieldType.number) {
          const stats = calculateStats({
            series,
            fieldIndex: i,
            stats: [stat], // The stats to calculate
            nullValueMode: NullValueMode.Null,
          });

          const v: SingleStatDisplay = {
            value: display(stats[stat]),
          };

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

    return values;
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <ProcessedValuesRepeater
        getProcessedValues={this.getProcessedValues}
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
