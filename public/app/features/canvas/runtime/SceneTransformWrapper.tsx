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
    scene.scale = scale;
  };

  const onZoomStop = (zoomPanPinchRef: ReactZoomPanPinchRef) => {
    const scale = zoomPanPinchRef.state.scale;
    scene.scale = scale;
    updateMoveable(scale);
  };

  const onTransformed = (
    _: ReactZoomPanPinchRef,
    state: {
      scale: number;
      positionX: number;
      positionY: number;
    }
  ) => {
    const scale = state.scale;
    scene.scale = scale;
    updateMoveable(scale);
  };

  const updateMoveable = (scale: number) => {
    if (scene.moveable && scale > 0) {
      scene.moveable.zoom = 1 / scale;
      if (scale === 1) {
        scene.moveable.snappable = true;
      } else {
        scene.moveable.snappable = false;
      }
    }
  };

  const onSceneContainerMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // If pan and zoom is disabled or context menu is visible, don't pan
    if ((!scene.shouldPanZoom || scene.contextMenuVisible) && (e.button === 1 || (e.button === 2 && e.ctrlKey))) {
      e.preventDefault();
      e.stopPropagation();
    }

    // If context menu is hidden, ignore left mouse or non-ctrl right mouse for pan
    if (!scene.contextMenuVisible && !scene.isPanelEditing && e.button === 2 && !e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <TransformWrapper
      doubleClick={{ mode: 'reset' }}
      ref={scene.transformComponentRef}
      onZoom={onZoom}
      onZoomStop={onZoomStop}
      onTransformed={onTransformed}
      limitToBounds={true}
      disabled={!config.featureToggles.canvasPanelPanZoom || !scene.shouldPanZoom}
      panning={{ allowLeftClickPan: false }}
    >
      <TransformComponent>
        {/* The <div> element has child elements that allow for mouse events, so we need to disable the linter rule */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onMouseDown={onSceneContainerMouseDown}>{sceneDiv}</div>
      </TransformComponent>
    </TransformWrapper>
  );
};
