import { isNumber } from 'lodash';
import { type JSX } from 'react';

import {
  type DisplayProcessor,
  type DisplayValueAlignmentFactors,
  type FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  type PanelProps,
  VizOrientation,
} from '@grafana/data';
import { BarGaugeSizing } from '@grafana/schema';
import {
  BarGauge,
  DataLinksContextMenu,
  useTheme2,
  VizLayout,
  VizRepeater,
  type VizRepeaterRenderValueProps,
} from '@grafana/ui';
import { type DataLinksContextMenuApi } from '@grafana/ui/internal';

import { BarGaugeLegend } from './BarGaugeLegend';
import { defaultOptions, type Options } from './panelcfg.gen';

export type BarGaugePanelProps = PanelProps<Options>;

export function BarGaugePanel(props: BarGaugePanelProps) {
  const { height, width, options, data, renderCounter, fieldConfig, replaceVariables, timeZone } = props;
  const theme = useTheme2();

  const renderComponent = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps: DataLinksContextMenuApi
  ): JSX.Element => {
    const { value, alignmentFactors, orientation, width, height, count } = valueProps;
    const { field, display, view, colIndex } = value;
    const { openMenu, targetClassName } = menuProps;
    const spacing = getItemSpacing(options.displayMode);
    // check if the total height is bigger than the visualization height, if so, there will be scrollbars for overflow
    const isOverflow = (height + spacing) * count - spacing > props.height;

    let processor: DisplayProcessor | undefined = undefined;
    if (view && isNumber(colIndex)) {
      processor = view.getFieldDisplayProcessor(colIndex);
    }

    return (
      <BarGauge
        value={display}
        width={width}
        height={height}
        orientation={orientation}
        field={field}
        text={options.text}
        display={processor}
        theme={theme}
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

  const renderValue = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>
  ): JSX.Element => {
    const { value, orientation } = valueProps;
    const { hasLinks, getLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <div style={{ width: '100%', display: orientation === VizOrientation.Vertical ? 'flex' : 'initial' }}>
          <DataLinksContextMenu style={{ height: '100%' }} links={getLinks}>
            {(api) => renderComponent(valueProps, api)}
          </DataLinksContextMenu>
        </div>
      );
    }

    return renderComponent(valueProps, {});
  };

  const getValues = (): FieldDisplay[] => {
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme,
      data: data.series,
      timeZone,
    });
  };

  const { minVizWidth, minVizHeight, maxVizHeight } = calcBarSize(
    options,
    getOrientation(options.orientation, width, height)
  );

  return (
    <VizLayout width={width} height={height} legend={getLegend(options, data)}>
      {(vizWidth: number, vizHeight: number) => {
        return (
          <VizRepeater
            source={data}
            getAlignmentFactors={getDisplayValueAlignmentFactors}
            getValues={getValues}
            renderValue={renderValue}
            renderCounter={renderCounter}
            width={vizWidth}
            height={vizHeight}
            maxVizHeight={maxVizHeight}
            minVizWidth={minVizWidth}
            minVizHeight={minVizHeight}
            itemSpacing={getItemSpacing(options.displayMode)}
            orientation={options.orientation}
          />
        );
      }}
    </VizLayout>
  );
}

export function getItemSpacing(displayMode: Options['displayMode']): number {
  if (displayMode === 'lcd') {
    return 2;
  }

  return 10;
}

export function getOrientation(orientation: VizOrientation, width: number, height: number): VizOrientation {
  if (orientation === VizOrientation.Auto) {
    if (width > height) {
      return VizOrientation.Vertical;
    } else {
      return VizOrientation.Horizontal;
    }
  }

  return orientation;
}

export function calcBarSize(options: Options, orientation: VizOrientation) {
  const isManualSizing = options.sizing === BarGaugeSizing.Manual;
  const isVertical = orientation === VizOrientation.Vertical;
  const isHorizontal = orientation === VizOrientation.Horizontal;
  const minVizWidth = isManualSizing && isVertical ? options.minVizWidth : defaultOptions.minVizWidth;
  const minVizHeight = isManualSizing && isHorizontal ? options.minVizHeight : defaultOptions.minVizHeight;
  const maxVizHeight = isManualSizing && isHorizontal ? options.maxVizHeight : defaultOptions.maxVizHeight;

  return { minVizWidth, minVizHeight, maxVizHeight };
}

export function getLegend(options: Options, data: BarGaugePanelProps['data']) {
  const { legend } = options;

  if (legend.showLegend && data && data.series.length > 0) {
    return <BarGaugeLegend data={data.series} {...legend} />;
  }

  return null;
}

