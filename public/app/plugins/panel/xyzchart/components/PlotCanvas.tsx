import { Canvas } from '@react-three/fiber';
import React, { createRef, useEffect, useState, RefObject, ReactNode, Suspense } from 'react';

import { DataFrame } from '@grafana/data';

import { WHITE } from '../consts';
import { ScatterPlotOptions } from '../models.gen';
import { OptionsProvider } from '../optionsContext';
import { getIntervalLabels, prepData } from '../utils';

import { Camera } from './Camera';
import { GridVolume } from './GridVolume';
import { PointCloud } from './PointCloud';
interface Props {
  frames: DataFrame[];
  options: ScatterPlotOptions;
}

export const PlotCanvas: React.FC<Props> = ({ frames, options }) => {
  let ambLightRef: RefObject<ReactNode> = createRef();
  let pntLightRef: RefObject<ReactNode> = createRef();
  const [pointData, setPointData] = useState(prepData(frames, options.pointColor ?? '#ff0000'));
  const [intervalLabels, setIntervalLabels] = useState(getIntervalLabels(frames));

  useEffect(() => {
    const newLabels = getIntervalLabels(frames);

    setIntervalLabels(newLabels);
    setPointData(prepData(frames, options.pointColor ?? '#ff0000'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames]);

  return (
    <>
      <Canvas mode="concurrent" raycaster={{ params: { Points: { threshold: 2 } } }} linear flat>
        {/* 
          Context does not work outside of Canvas. Seems Canvas is outside parent component in DOM 
          https://github.com/facebook/react/issues/17126
        */}
        <OptionsProvider value={options}>
          <Camera />
          <ambientLight ref={ambLightRef} intensity={0.8} color={WHITE} />
          <pointLight ref={pntLightRef} intensity={1.0} position={[10, 10, 10]} />
          <Suspense fallback={null}>
            <PointCloud frames={frames} points={pointData} lights={[ambLightRef, pntLightRef]} />
          </Suspense>
          <GridVolume intervalLabels={intervalLabels} />
        </OptionsProvider>
      </Canvas>
    </>
  );
};
