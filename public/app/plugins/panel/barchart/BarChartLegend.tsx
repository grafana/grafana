import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { DataFrame, Field, FieldColorModeId } from '@grafana/data';
import { config } from '@grafana/runtime';
import { VizLayout, VizLegend, VizLegendItem, VizLegendOptions, useStyles2 } from '@grafana/ui';

interface BarChartLegendProps {
  frame: DataFrame;
  options: VizLegendOptions;
  colorField?: Field | null;
}

export const BarChartLegend = React.memo(({ frame, colorField, options }: BarChartLegendProps) => {
  const styles = useStyles2(getStyles);
  const { palette, getColorByName } = config.theme2.visualization;

  const numSeries = useMemo(
    () =>
      frame.fields.reduce((acc, field, idx) => acc + (idx === 0 || field.config.custom.hideFrom?.legend ? 0 : 1), 0),
    [frame]
  );

  // if enum exists, then use that. if mappings exist, then use that,

  // // timelinechart get legend item
  // //
  // if (numSeries === 1) {
  //   let yField = frame.fields[1];

  //   && frame.fields[1].config.color?.mode === FieldColorModeId.Thresholds || frame.fields[1].config.custom.color
  //   // if scheme is by value && thresholds or mappings
  //   colorField = frame.fields[1];
  //   // mappings
  //   // thresholds
  //   // enum
  //   //
  // }

  const items: VizLegendItem[] = [];

  // or single frame + single series + color by value?
  if (colorField != null) {
    // TODO: by color
    // maybe use getFieldLegendItem?
    return null;

    // the color by field can also be the yField itself (thresholds, etc)
  } else {
    let fields = frame.fields;

    let paletteIdx = 0;

    for (let i = 1; i < fields.length; i++) {
      let yField = fields[i];

      if (!yField.config.custom.hideFrom?.legend) {
        let colorCfg = yField.config.color ?? { mode: FieldColorModeId.PaletteClassic };
        let name = yField.state?.displayName ?? yField.name;

        let color: string;

        if (colorCfg.mode === FieldColorModeId.PaletteClassic) {
          color = getColorByName(palette[paletteIdx++ % palette.length]); // todo: do this via state.seriesIdx and re-init displayProcessor
        } else if (colorCfg.mode === FieldColorModeId.Fixed) {
          color = getColorByName(colorCfg.fixedColor!);
        }

        // TODO: calcs / PlotLegend?

        items.push({
          yAxis: 1, // TODO: pull from y field
          label: name,
          color: color!,
          getItemKey: () => `${i}-${name}`,
          disabled: yField.state?.hideFrom?.viz ?? false,
        });
      }
    }
  }

  // sort series by calcs? table mode?

  const { placement, displayMode, width } = options;

  return (
    <VizLayout.Legend placement={placement} width={width}>
      <VizLegend className={styles.legend} placement={placement} items={items} displayMode={displayMode} />
    </VizLayout.Legend>
  );
});

BarChartLegend.displayName = 'BarChartLegend';

const getStyles = () => ({
  legend: css({
    div: {
      justifyContent: 'flex-start',
    },
  }),
});
