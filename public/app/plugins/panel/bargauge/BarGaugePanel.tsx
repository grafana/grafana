import { isNumber } from 'lodash';
import { PureComponent } from 'react';

import {
  DisplayProcessor,
  DisplayValue,
  DisplayValueAlignmentFactors,
  FieldConfig,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  PanelProps,
  VizOrientation,
} from '@grafana/data';
import { BarGaugeSizing } from '@grafana/schema';
import { BarGauge, DataLinksContextMenu, VizLayout, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/internal';
import { config } from 'app/core/config';

import { BarGaugeLegend } from './BarGaugeLegend';
import { defaultOptions, Options } from './panelcfg.gen';

export class BarGaugePanel extends PureComponent<BarGaugePanelProps> {
  renderComponent = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps: DataLinksContextMenuApi
  ): JSX.Element => {
    const { options, fieldConfig } = this.props;
    const { value, alignmentFactors, orientation, width, height, count } = valueProps;
    const { field, display, view, colIndex } = value;
    const { openMenu, targetClassName } = menuProps;
    const spacing = this.getItemSpacing();
    // check if the total height is bigger than the visualization height, if so, there will be scrollbars for overflow
    const isOverflow = (height + spacing) * count - spacing > this.props.height;

    let processor: DisplayProcessor | undefined = undefined;
    if (view && isNumber(colIndex)) {
      processor = view.getFieldDisplayProcessor(colIndex);
    }

    return (
      <BarGauge
        value={clearNameForSingleSeries(count, fieldConfig.defaults, display)}
        width={width}
        height={height}
        orientation={orientation}
        field={field}
        text={options.text}
        display={processor}
        theme={config.theme2}
        itemSpacing={spacing}
        displayMode={options.displayMode}
        onClick={openMenu}
        className={targetClassName}
        alignmentFactors={count > 1 ? alignmentFactors : undefined}
        showUnfilled={options.showUnfilled}
        valueDisplayMode={options.valueMode}
        namePlacement={options.namePlacement}
        isOverflow={isOverflow}
      />
    );
  };

  renderValue = (valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>): JSX.Element => {
    const { value, orientation } = valueProps;
    const { hasLinks, getLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <div style={{ width: '100%', display: orientation === VizOrientation.Vertical ? 'flex' : 'initial' }}>
          <DataLinksContextMenu style={{ height: '100%' }} links={getLinks}>
            {(api) => this.renderComponent(valueProps, api)}
          </DataLinksContextMenu>
        </div>
      );
    }

    return this.renderComponent(valueProps, {});
  };

  getValues = (): FieldDisplay[] => {
    const { data, options, replaceVariables, fieldConfig, timeZone } = this.props;

    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme2,
      data: data.series,
      timeZone,
    });
  };

  getItemSpacing(): number {
    if (this.props.options.displayMode === 'lcd') {
      return 2;
    }

    return 10;
  }

  getOrientation(): VizOrientation {
    const { options, width, height } = this.props;
    const { orientation } = options;

    if (orientation === VizOrientation.Auto) {
      if (width > height) {
        return VizOrientation.Vertical;
      } else {
        return VizOrientation.Horizontal;
      }
    }

    return orientation;
  }

  calcBarSize() {
    const { options } = this.props;

    const orientation = this.getOrientation();
    const isManualSizing = options.sizing === BarGaugeSizing.Manual;
    const isVertical = orientation === VizOrientation.Vertical;
    const isHorizontal = orientation === VizOrientation.Horizontal;
    const minVizWidth = isManualSizing && isVertical ? options.minVizWidth : defaultOptions.minVizWidth;
    const minVizHeight = isManualSizing && isHorizontal ? options.minVizHeight : defaultOptions.minVizHeight;
    const maxVizHeight = isManualSizing && isHorizontal ? options.maxVizHeight : defaultOptions.maxVizHeight;

    return { minVizWidth, minVizHeight, maxVizHeight };
  }

  getLegend() {
    const { options, data } = this.props;
    const { legend } = options;

    if (legend.showLegend && data && data.series.length > 0) {
      return <BarGaugeLegend data={data.series} {...legend} />;
    }

    return null;
  }

  render() {
    const { height, width, options, data, renderCounter } = this.props;

    const { minVizWidth, minVizHeight, maxVizHeight } = this.calcBarSize();

    return (
      <VizLayout width={width} height={height} legend={this.getLegend()}>
        {(vizWidth: number, vizHeight: number) => {
          return (
            <VizRepeater
              source={data}
              getAlignmentFactors={getDisplayValueAlignmentFactors}
              getValues={this.getValues}
              renderValue={this.renderValue}
              renderCounter={renderCounter}
              width={vizWidth}
              height={vizHeight}
              maxVizHeight={maxVizHeight}
              minVizWidth={minVizWidth}
              minVizHeight={minVizHeight}
              itemSpacing={this.getItemSpacing()}
              orientation={options.orientation}
            />
          );
        }}
      </VizLayout>
    );
  }
}
export type BarGaugePanelProps = PanelProps<Options>;

export function clearNameForSingleSeries(count: number, field: FieldConfig, display: DisplayValue): DisplayValue {
  if (count === 1 && !field.displayName) {
    return {
      ...display,
      title: undefined,
    };
  }

  return display;
}
