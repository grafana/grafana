import { useMemo } from 'react';

import { type PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode, TooltipPlugin2, UPlotChart, VizLayout, useTheme2 } from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/internal';

import { BoxplotTooltip } from './BoxplotTooltip';
import { prepBoxplotData } from './fields';
import { type Options } from './panelcfg.gen';
import { prepConfig } from './utils';

export const BoxplotPanel = ({ data, options, fieldConfig, width, height, id }: PanelProps<Options>) => {
  const theme = useTheme2();

  const info = useMemo(() => prepBoxplotData(data.series, options.fields, theme), [data.series, options.fields, theme]);

  const { builder, alignedData } = useMemo(
    () => (info.rows.length === 0 ? { builder: null, alignedData: null } : prepConfig({ data: info, options, theme })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [info, options.boxWidth, options.outlierSize, theme, data.structureRev]
  );

  if (builder == null || alignedData == null) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        message={info.warn ?? ''}
        needsNumberField={true}
      />
    );
  }

  return (
    <VizLayout width={width} height={height}>
      {(vizWidth, vizHeight) => (
        <UPlotChart config={builder} data={alignedData} width={vizWidth} height={vizHeight}>
          {options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={builder}
              maxWidth={options.tooltip.maxWidth}
              hoverMode={TooltipHoverMode.xOne}
              render={(u, dataIdxs) => {
                const idx = dataIdxs.find((v) => v != null);
                const row = idx == null ? undefined : info.rows[idx];
                if (!row) {
                  return null;
                }
                return <BoxplotTooltip row={row} display={info.display} />;
              }}
            />
          )}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
