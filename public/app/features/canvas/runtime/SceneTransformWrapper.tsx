import React from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

import { config } from '@grafana/runtime';

import { Scene } from './scene';

type SceneTransformWrapperProps = {
  scene: Scene;
  children: React.ReactNode;
};

export const SceneTransformWrapper = ({ scene, children: sceneDiv }: SceneTransformWrapperProps) => {
  const onZoom = (zoomPanPinchRef: ReactZoomPanPinchRef) => {
    const scale = zoomPanPinchRef.state.scale;
    if (scene.moveable && scale > 0) {
      scene.moveable.zoom = 1 / scale;
    }
    scene.scale = scale;
  };

  return (
    <TransformWrapper
      doubleClick={{ mode: 'reset' }}
      ref={scene.transformComponentRef}
      onZoom={onZoom}
      onTransformed={(_, state) => {
        scene.scale = state.scale;
      }}
      limitToBounds={true}
      disabled={!config.featureToggles.canvasPanelPanZoom || !scene.shouldPanZoom}
      panning={{ allowLeftClickPan: false }}
    >
      <TransformComponent>{sceneDiv}</TransformComponent>
    </TransformWrapper>
  );
};
