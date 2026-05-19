import { css } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import {
  type DisplayValueAlignmentFactors,
  type FieldDisplay,
  getDisplayProcessor,
  getDisplayValueAlignmentFactors,
  getFieldDisplayValues,
  type PanelProps,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { DataLinksContextMenu, Stack, useStyles2, VizRepeater, type VizRepeaterRenderValueProps } from '@grafana/ui';
import { type DataLinksContextMenuApi, RadialGauge } from '@grafana/ui/internal';

import { type Options } from './panelcfg.gen';

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
  const values: FieldDisplay[] = useMemo(() => {
    // TODO: this is carried over from v1, but it really ought to live somewhere inside of the data processing pipeline.
    // Without this, gauges which have percentage units and percentage thresholds will not automatically select a 0-100% min max
    // and their colors will potentially be wrong.
    for (let frame of data.series) {
      for (let field of frame.fields) {
        // Set the Min/Max value automatically for percent and percentunit
        if (field.config.unit === 'percent' || field.config.unit === 'percentunit') {
          const min = field.config.min ?? 0;
          const max = field.config.max ?? (field.config.unit === 'percent' ? 100 : 1);
          field.state = field.state ?? {};
          field.state.range = { min, max, delta: max - min };
          field.display = getDisplayProcessor({ field, theme: config.theme2 });
        }
      }
    }

    return getFieldDisplayValues({
      fieldConfig,
      reduceOptions: options.reduceOptions,
      replaceVariables,
      theme: config.theme2,
      data: data.series,
      sparkline: options.sparkline,
      timeZone,
    });
  }, [data, fieldConfig, options.reduceOptions, options.sparkline, replaceVariables, timeZone]);

  const renderValue = useMemo(() => renderValueFactory(options), [options]);

  if (values[0]?.display?.text === 'No data') {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} needsNumberField />;
  }

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" height={'100%'}>
      <VizRepeater
        getValues={() => values}
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

const renderValueFactory = (options: Options) => {
  const renderRadialGauge = (
    {
      width,
      height,
      value,
      alignmentFactors,
      count,
    }: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>,
    menuProps?: DataLinksContextMenuApi
  ): JSX.Element => {
    let el = (
      <RadialGauge
        alignmentFactors={alignmentFactors}
        barWidthFactor={options.barWidthFactor}
        endpointMarker={options.endpointMarker !== 'none' ? options.endpointMarker : undefined}
        glowBar={options.effects?.barGlow}
        glowCenter={options.effects?.centerGlow}
        gradient={options.effects?.gradient}
        height={height}
        nameManualFontSize={options.text?.titleSize}
        neutral={options.neutral}
        roundedBars={options.barShape === 'rounded'}
        segmentCount={options.segmentCount}
        segmentSpacing={options.segmentSpacing}
        shape={options.shape}
        showScaleLabels={options.showThresholdLabels}
        textMode={options.textMode}
        thresholdsBar={options.showThresholdMarkers}
        valueManualFontSize={options.text?.valueSize}
        values={[value]}
        vizCount={count}
        width={width}
      />
    );
    if (menuProps?.openMenu) {
      el = <DataLinkMenuWrapper openMenu={menuProps.openMenu}>{el}</DataLinkMenuWrapper>;
    }
    return el;
  };

  const renderValue = (
    valueProps: VizRepeaterRenderValueProps<FieldDisplay, DisplayValueAlignmentFactors>
  ): JSX.Element => {
    const { value } = valueProps;
    const { getLinks, hasLinks } = value;

    if (hasLinks && getLinks) {
      return (
        <DataLinksContextMenu links={getLinks} style={{ flexGrow: 1 }}>
          {(api) => renderRadialGauge(valueProps, api)}
        </DataLinksContextMenu>
      );
    }

    return renderRadialGauge(valueProps);
  };

  return renderValue;
};

function DataLinkMenuWrapper({
  children,
  openMenu,
}: {
  children: React.ReactNode;
  openMenu: DataLinksContextMenuApi['openMenu'];
}) {
  const styles = useStyles2(getDataLinkMenuWrapperStyles);
  return (
    <button
      className={styles}
      onClick={openMenu}
      aria-label={t('gauge.data-links-actions-menu', 'Open data links and actions menu')}
    >
      {children}
    </button>
  );
}

const getDataLinkMenuWrapperStyles = () =>
  css({
    cursor: 'context-menu',
    background: 'none',
    border: 'none',
  });
