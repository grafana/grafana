import { FieldDisplay, getFieldDisplayValues, PanelProps } from '@grafana/data';
import { DataLinksContextMenu, RadialGauge, Stack, VizRepeater, VizRepeaterRenderValueProps } from '@grafana/ui';
import { DataLinksContextMenuApi } from '@grafana/ui/internal';
import { config } from 'app/core/config';

import { Options } from './panelcfg.gen';

export function RadialBarPanel({
  height,
  width,
  data,
  renderCounter,
  options,
  replaceVariables,
  fieldConfig,
  timeZone,
}: PanelProps<Options>) {
  function renderComponent(valueProps: VizRepeaterRenderValueProps<FieldDisplay>, menuProps: DataLinksContextMenuApi) {
    const { width, height, value } = valueProps;

    return (
      <RadialGauge
        values={[value]}
        width={width}
        height={height}
        clockwise
        barWidthFactor={options.barWidthFactor}
        gradient={options.gradient}
        spotlight={options.effects?.spotlight}
        glowBar={options.effects?.barGlow}
        glowCenter={options.effects?.centerGlow}
        vizCount={valueProps.count}
        shape={options.shape}
        segmentCount={options.segmentCount}
        segmentSpacing={options.segmentSpacing}
      />
    );
  }

  function renderValue(valueProps: VizRepeaterRenderValueProps<FieldDisplay>): JSX.Element {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <DataLinksContextMenu links={getLinks} style={{ flexGrow: 1 }}>
          {(api) => {
            return renderComponent(valueProps, api);
          }}
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

  const minVizHeight = 60;
  const minVizWidth = 60;

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
        minVizHeight={minVizHeight}
        minVizWidth={minVizWidth}
      />
    </Stack>
  );
}
