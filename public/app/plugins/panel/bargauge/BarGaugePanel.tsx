import { isNumber } from 'lodash';
import { type JSX } from 'react';

import {
  type DisplayProcessor,
  type DisplayValueAlignmentFactors,
  type FieldConfig,
  type FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  type PanelProps,
  VizOrientation,
} from '@grafana/data';
import { BarGaugeSizing, BarGaugeValueMode, BigValueTextMode } from '@grafana/schema';
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
        value={
          shouldShowName(options.textMode, count, fieldConfig.defaults) ? display : { ...display, title: undefined }
        }
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
        valueDisplayMode={shouldShowValue(options.textMode) ? options.valueMode : BarGaugeValueMode.Hidden}
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
            getAlignmentFactors={(values) => getBarGaugeAlignmentFactors(values, options)}
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

// BarGauge sizes the shared name column/row from alignmentFactors.title, so it must reflect the
// same per-bar suppression as renderComponent's name-clearing, or hidden names still reserve
// layout space even though nothing is drawn there.
export function getBarGaugeAlignmentFactors(values: FieldDisplay[], options: Options): DisplayValueAlignmentFactors {
  const count = values.length;
  return getDisplayValueAlignmentFactors(
    values.map((value) => ({
      ...value,
      display: shouldShowName(options.textMode, count, value.field)
        ? value.display
        : { ...value.display, title: undefined },
    }))
  );
}

// Auto keeps the historical single-bar heuristic; any other explicit choice decides
// name visibility outright, independent of bar count, so it must override that heuristic.
function shouldShowName(textMode: BigValueTextMode, count: number, field: FieldConfig): boolean {
  if (textMode === BigValueTextMode.Auto) {
    return count !== 1 || Boolean(field.displayName);
  }

  return textMode === BigValueTextMode.Name || textMode === BigValueTextMode.ValueAndName;
}

// Matches Gauge/Stat: Name and None hide the value, independent of the "Value display" setting.
function shouldShowValue(textMode: BigValueTextMode): boolean {
  return textMode !== BigValueTextMode.Name && textMode !== BigValueTextMode.None;
}
