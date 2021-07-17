import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';

import { CandlestickPlot } from './CandlestickPlot';
import { PanelOptions } from './models.gen';
import { useTheme2 } from '@grafana/ui';
import { prepareCandlestickFields } from './utils';

type Props = PanelProps<PanelOptions>;

export const CandlestickPanel: React.FC<Props> = ({ data, options, width, height }) => {
  const theme = useTheme2();

  const fields = useMemo(() => prepareCandlestickFields(data?.series, options ?? {}), [data, options]);

  if (!fields || fields.warning) {
    return (
      <div className="panel-empty">
        <p>{fields.warning ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <CandlestickPlot
      options={options}
      theme={theme}
      structureRev={data.structureRev}
      width={width}
      height={height}
      fields={fields}
    >
      {(config, alignedFrame) => {
        return null; // <TooltipPlugin data={alignedFrame} config={config} mode={options.tooltip.mode} timeZone={timeZone} />;
      }}
    </CandlestickPlot>
  );
};
