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

export function GaugePanel({
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
        alignmentFactors={valueProps.alignmentFactors}
        barWidthFactor={options.barWidthFactor}
        endpointMarker={options.endpointMarker !== 'none' ? options.endpointMarker : undefined}
        glowBar={options.effects?.barGlow}
        glowCenter={options.effects?.centerGlow}
        gradient={options.effects?.gradient}
        height={height}
        nameManualFontSize={options.text?.titleSize}
        neutral={options.neutral}
        onClick={menuProps.openMenu}
        roundedBars={options.barShape === 'rounded'}
        segmentCount={options.segmentCount}
        segmentSpacing={options.segmentSpacing}
        shape={options.shape}
        showScaleLabels={options.showThresholdLabels}
        textMode={options.textMode}
        thresholdsBar={options.showThresholdMarkers}
        valueManualFontSize={options.text?.valueSize}
        values={[value]}
        vizCount={valueProps.count}
        width={width}
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
