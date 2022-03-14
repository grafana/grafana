import { PanelData } from '@grafana/data';
import React, { useMemo } from 'react';
import { FlameGraphRendererWrapper } from '../../plugins/panel/flameGraph/FlameGraphRendererWrapper';

export const ExploreProfile = ({ data, width }: { data: PanelData; width: number }) => {
  const flamebearers = useMemo(
    () => (data?.state === 'Done' ? data?.series?.map((s) => (s?.fields?.[0]?.values as any)?.buffer[0]) : []),
    [data]
  );

  return (
    <>
      {flamebearers?.map((f) => (
        <FlameGraphRendererWrapper key={f?.name} width={width} height={500} flamebearer={f} />
      ))}
    </>
  );
};
