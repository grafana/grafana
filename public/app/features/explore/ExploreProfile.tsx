import React from 'react';
import { PanelData } from '@grafana/data';
import { FlameGraphRendererWrapper } from '../../plugins/panel/flameGraph/FlameGraphRendererWrapper';
import { useGetFlamebearers } from '../../plugins/panel/flameGraph/utils/useGetFlamebearers';

export const ExploreProfile = ({ data, width }: { data: PanelData; width: number }) => {
  const flamebearers = useGetFlamebearers({ data });

  return (
    <>
      {flamebearers?.map((f) => (
        <FlameGraphRendererWrapper key={f?.name} width={width} height={500} flamebearer={f} />
      ))}
    </>
  );
};
