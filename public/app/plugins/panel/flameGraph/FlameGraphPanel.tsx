import React, { FunctionComponent } from 'react';
import { FlameGraphRendererWrapper } from './FlameGraphRendererWrapper';
import { Options } from './types';
import { PanelProps } from '@grafana/data';
import { useGetFlamebearers } from './utils/useGetFlamebearers';

export const FlameGraphPanel: FunctionComponent<PanelProps<Options>> = ({ width, data }) => {
  const flamebearers = useGetFlamebearers({ data });

  return (
    <>
      {flamebearers?.map((f) => (
        <FlameGraphRendererWrapper key={f?.name} width={width} height={500} flamebearer={f} />
      ))}
    </>
  );
};
