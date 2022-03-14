import React, { useMemo, FunctionComponent } from 'react';
import { FlameGraphRendererWrapper } from './FlameGraphRendererWrapper';
import { Options } from './types';
import { PanelProps } from '@grafana/data';

export const FlameGraphPanel: FunctionComponent<PanelProps<Options>> = ({ width, data }) => {
  const flamebearers = useMemo(() => {
    return data?.state === 'Done'
      ? data?.series?.map((s) => {
          return (s?.fields?.[0]?.values as any)?.buffer[0];
        })
      : [];
  }, [data]);

  return (
    <>
      {flamebearers?.map((f) => {
        return <FlameGraphRendererWrapper key={f?.name} width={width} height={500} flamebearer={f} />;
      })}
    </>
  );
};
