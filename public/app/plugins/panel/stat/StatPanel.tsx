import { isNumber } from 'lodash';
import { memo, useCallback } from 'react';

import {
  DisplayValueAlignmentFactors,
  FieldDisplay,
  FieldType,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  NumericRange,
  PanelProps,
} from '@grafana/data';
import { findNumericFieldMinMax } from '@grafana/data/internal';
import { BigValueTextMode, BigValueGraphMode } from '@grafana/schema';
import { BigValue, DataLinksContextMenu, useTheme2, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/internal';

import { Options } from './panelcfg.gen';

export const StatPanel = memo(
  ({
    timeRange,
    options,
    fieldConfig,
    title,
    data,
    replaceVariables,
    timeZone,
    height,
    width,
    renderCounter,
  }: PanelProps<Options>) => {
    const theme = useTheme2();

    const getTextMode = useCallback(() => {
      // If we have manually set displayName or panel title switch text mode to value and name
      if (options.textMode === BigValueTextMode.Auto && (fieldConfig.defaults.displayName || !title)) {
        return BigValueTextMode.ValueAndName;
      }

      return options.textMode;
    }, [options.textMode, fieldConfig.defaults.displayName, title]);

    const renderComponent = useCallback(
      (
        valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
        menuProps: DataLinksContextMenuApi
      ): JSX.Element => {
        const { value, alignmentFactors, width, height, count } = valueProps;
        const { openMenu, targetClassName } = menuProps;
        let sparkline = value.sparkline;
        if (sparkline) {
          sparkline.timeRange = timeRange;
        }

        return (
          <BigValue
            value={value.display}
            count={count}
            sparkline={sparkline}
            colorMode={options.colorMode}
            graphMode={options.graphMode}
            justifyMode={options.justifyMode}
            textMode={getTextMode()}
            alignmentFactors={alignmentFactors}
            text={options.text}
            width={width}
            height={height}
            theme={theme}
            onClick={openMenu}
            className={targetClassName}
            disableWideLayout={!options.wideLayout}
            percentChangeColorMode={options.percentChangeColorMode}
          />
        );
      },
      [theme, timeRange, options, getTextMode]
    );

    const renderValue = useCallback(
      (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
        const { value } = valueProps;
        const { getLinks, hasLinks } = value;

        if (hasLinks && getLinks) {
          return (
            <DataLinksContextMenu links={getLinks}>
              {(api) => {
                return renderComponent(valueProps, api);
              }}
            </DataLinksContextMenu>
          );
        }

        return renderComponent(valueProps, {});
      },
      [renderComponent]
    );

    const getValues = useCallback((): FieldDisplay[] => {
      let globalRange: NumericRange | undefined = undefined;

      for (let frame of data.series) {
        for (let field of frame.fields) {
          let { config } = field;
          // mostly copied from fieldOverrides, since they are skipped during streaming
          // Set the Min/Max value automatically
          if (field.type === FieldType.number) {
            if (field.state?.range) {
              continue;
            }
            if (!globalRange && (!isNumber(config.min) || !isNumber(config.max))) {
              globalRange = findNumericFieldMinMax(data.series);
            }
            const min = config.min ?? globalRange!.min;
            const max = config.max ?? globalRange!.max;
            field.state = field.state ?? {};
            field.state.range = { min, max, delta: max! - min! };
          }
        }
      }

      return getFieldDisplayValues({
        fieldConfig,
        reduceOptions: options.reduceOptions,
        replaceVariables,
        theme,
        data: data.series,
        sparkline: options.graphMode !== BigValueGraphMode.None,
        percentChange: options.showPercentChange,
        timeZone,
      });
    }, [data, fieldConfig, theme, options, replaceVariables, timeZone]);

    return (
      <VizRepeater
        getValues={getValues}
        getAlignmentFactors={getDisplayValueAlignmentFactors}
        renderValue={renderValue}
        width={width}
        height={height}
        source={data}
        itemSpacing={3}
        renderCounter={renderCounter}
        autoGrid={true}
        orientation={options.orientation}
      />
    );
  }
);
StatPanel.displayName = 'StatPanel';
