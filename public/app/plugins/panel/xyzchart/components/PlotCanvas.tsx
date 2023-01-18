import { Html, useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import React, { createRef, useEffect, useState, RefObject, Suspense } from 'react';
import { AmbientLight, PointLight } from 'three';

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

export const PlotCanvas = ({ frames, options }: Props) => {
  let ambLightRef: RefObject<AmbientLight> = createRef();
  let pntLightRef: RefObject<PointLight> = createRef();
  const [pointData, setPointData] = useState(prepData(frames, options.pointColor ?? '#ff0000'));
  const [intervalLabels, setIntervalLabels] = useState(getIntervalLabels(frames));

  useEffect(() => {
    const newLabels = getIntervalLabels(frames);

    setIntervalLabels(newLabels);
    setPointData(prepData(frames, options.pointColor ?? '#ff0000'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames]);

  function Loader() {
    const { progress } = useProgress();
    return <Html center>{progress} % loaded</Html>;
  }

  return (
    <>
      <Canvas raycaster={{ params: { Points: { threshold: 2 } } }} linear flat>
        {/* 
          Context does not work outside of Canvas. Seems Canvas is outside parent component in DOM 
          https://github.com/facebook/react/issues/17126
        */}
        <Suspense fallback={<Loader />}>
          <OptionsProvider value={options}>
            <Camera />
            {/* eslint-disable-next-line */}
            <ambientLight ref={ambLightRef} intensity={0.8} color={WHITE} />
            {/* eslint-disable-next-line */}
            <pointLight ref={pntLightRef} intensity={1.0} position={[10, 10, 10]} />
            <PointCloud frames={frames} points={pointData} lights={[ambLightRef, pntLightRef]} />
            <GridVolume intervalLabels={intervalLabels} />
          </OptionsProvider>
        </Suspense>
      </Canvas>
    </>
  );
};
