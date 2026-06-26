import * as React from 'react';
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

    if (scene.shouldInfinitePan) {
      const isScaleZoomedOut = scale < 1;

      if (isScaleZoomedOut) {
        scene.updateSize(scene.width / scale, scene.height / scale);
        scene.panel.forceUpdate();
      }
    }
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

  const onPanning = (_: ReactZoomPanPinchRef, event: MouseEvent | TouchEvent) => {
    if (scene.shouldInfinitePan && event instanceof MouseEvent) {
      // Get deltaX and deltaY from pan event and add it to current canvas dimensions
      let deltaX = event.movementX;
      let deltaY = event.movementY;
      if (deltaX > 0) {
        deltaX = 0;
      }
      if (deltaY > 0) {
        deltaY = 0;
      }

      // TODO: Consider bounding to the scene elements instead of allowing "infinite" panning
      // TODO: Consider making scene grow in all directions vs just down to the right / bottom
      scene.updateSize(scene.width - deltaX, scene.height - deltaY);
      scene.panel.forceUpdate();
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

  // Set panel content overflow to hidden to prevent canvas content from overflowing
  scene.div?.parentElement?.parentElement?.parentElement?.parentElement?.setAttribute('style', `overflow: hidden`);

  return (
    <TransformWrapper
      doubleClick={{ mode: 'reset' }}
      ref={scene.transformComponentRef}
      onZoom={onZoom}
      onZoomStop={onZoomStop}
      onTransformed={onTransformed}
      disabled={!config.featureToggles.canvasPanelPanZoom || !scene.shouldPanZoom}
      panning={{ allowLeftClickPan: false }}
      limitToBounds={!scene.shouldInfinitePan}
      minScale={scene.shouldInfinitePan ? 0.1 : undefined}
      onPanning={onPanning}
    >
      <TransformComponent>
        {/* The <div> element has child elements that allow for mouse events, so we need to disable the linter rule */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onMouseDown={onSceneContainerMouseDown}>{sceneDiv}</div>
      </TransformComponent>
    </TransformWrapper>
  );
};
