import type { JSX } from 'react';

import {
  DisplayValueAlignmentFactors,
  FieldDisplay,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  PanelProps,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { DataLinksContextMenu, Stack, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi, RadialGauge } from '@grafana/ui/internal';

import { Options } from './panelcfg.gen';

export function RadialBarPanel({
  id,
  height,
  width,
  data,
  renderCounter,
  options,
  replaceVariables,
  fieldConfig,
  timeZone,
}: PanelProps<Options>) {
  function renderComponent(
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps: DataLinksContextMenuApi
  ) {
    const { width, height, value } = valueProps;

    return (
      <RadialGauge
        values={[value]}
        width={width}
        height={height}
        barWidthFactor={options.barWidthFactor}
        gradient={options.effects?.gradient}
        glowBar={options.effects?.barGlow}
        glowCenter={options.effects?.centerGlow}
        roundedBars={options.barShape === 'rounded'}
        vizCount={valueProps.count}
        shape={options.shape}
        segmentCount={options.segmentCount}
        segmentSpacing={options.segmentSpacing}
        thresholdsBar={options.showThresholdMarkers}
        showScaleLabels={options.showThresholdLabels}
        alignmentFactors={valueProps.alignmentFactors}
        valueManualFontSize={options.text?.valueSize}
        nameManualFontSize={options.text?.titleSize}
        endpointMarker={options.endpointMarker !== 'none' ? options.endpointMarker : undefined}
        onClick={menuProps.openMenu}
        textMode={options.textMode}
      />
    );
  }

  function renderValue(
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>
  ): JSX.Element {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <DataLinksContextMenu links={getLinks} style={{ flexGrow: 1 }}>
          {(api) => renderComponent(valueProps, api)}
        </DataLinksContextMenu>
      );
    }

    return renderComponent(valueProps, {});
  }

  function getValues(): FieldDisplay[] {
    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme2,
      data: data.series,
      sparkline: options.sparkline,
      timeZone,
    });
  }

  if (getValues()[0]?.display?.text === 'No data') {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} needsNumberField />;
  }

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" height={'100%'}>
      <VizRepeater
        getValues={getValues}
        renderValue={renderValue}
        width={width}
        height={height}
        source={data}
        autoGrid={true}
        itemSpacing={16}
        renderCounter={renderCounter}
        orientation={options.orientation}
        minVizHeight={options.sizing === 'auto' ? 0 : options.minVizHeight}
        minVizWidth={options.sizing === 'auto' ? 0 : options.minVizWidth}
        getAlignmentFactors={getDisplayValueAlignmentFactors}
      />
    </Stack>
  );
}
