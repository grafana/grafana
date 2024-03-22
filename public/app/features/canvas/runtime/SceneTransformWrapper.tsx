import React from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';

import { config } from '@grafana/runtime';

import { Scene } from './scene';

type SceneTransformWrapperProps = {
  scene: Scene;
  children: React.ReactNode;
};

export const SceneTransformWrapper = ({ scene, children: sceneDiv }: SceneTransformWrapperProps) => {
  let sceneBounds: { width: number; height: number } | null = null;
  const onZoom = (zoomPanPinchRef: ReactZoomPanPinchRef) => {
    const scale = zoomPanPinchRef.state.scale;
    scene.scale = scale;

    // update the scene size based on the scale
    // const newSceneWidth = scale < 1 ? scene.width * scale : scene.width / scale;
    // const newSceneHeight = scale < 1 ? scene.height * scale : scene.height / scale;
    // scene.updateSize(newSceneWidth, newSceneHeight);
    // scene.panel.forceUpdate();
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

  // Set panel content overflow to hidden to prevent canvas content from overflowing
  scene.div?.parentElement?.parentElement?.parentElement?.parentElement?.setAttribute('style', `overflow: hidden`);

  return (
    <TransformWrapper
      doubleClick={{ mode: 'reset' }}
      ref={scene.transformComponentRef}
      onZoomStart={() => {
        // sceneBounds = scene.getBounds();
      }}
      onZoom={onZoom}
      onZoomStop={onZoomStop}
      onTransformed={onTransformed}
      limitToBounds={false}
      minScale={0.1}
      disabled={!config.featureToggles.canvasPanelPanZoom || !scene.shouldPanZoom}
      panning={{ allowLeftClickPan: false }}
      onPanningStart={() => {
        // set scene dimensions to the current canvas dimensions based on the elements in the scene
        // this is needed to prevent the scene from being panned out of bounds
        sceneBounds = scene.getBounds();
      }}
      onPanning={(r, e) => {
        const mouseEvent = e as MouseEvent;
        // Get deltaX and deltaY from pan event and add it to current canvas dimensions
        let deltaX = mouseEvent.movementX;
        let deltaY = mouseEvent.movementY;
        if (deltaX > 0) {
          deltaX = 0;
        }
        if (deltaY > 0) {
          deltaY = 0;
        }

        // only allow updating of size within the bounds of the scene's elements
        // basically we need a helper function to get the bounds of the scene based on the elements
        // that are in the scene
        if (sceneBounds) {
          const sceneWidth = sceneBounds.width;
          const sceneHeight = sceneBounds.height;

          if (scene.width - deltaX < sceneWidth) {
            deltaX = scene.width - sceneWidth;
          }
          if (scene.height - deltaY < sceneHeight) {
            deltaY = scene.height - sceneHeight;
          }
        }

        scene.updateSize(scene.width - deltaX, scene.height - deltaY);
        scene.panel.forceUpdate();
      }}
      onPanningStop={() => {
        // set scene size to the current panel dimensions
        const panelContentElement = scene.div?.parentElement?.parentElement?.parentElement?.parentElement;
        const sceneTransformWrapper = scene.div?.parentElement?.parentElement?.parentElement;
        const sceneTransformComponent = scene.div?.parentElement?.parentElement;

        if (panelContentElement && sceneTransformWrapper && sceneTransformComponent) {
          const panelWidth = panelContentElement.clientWidth;
          const panelHeight = panelContentElement.clientHeight;

          // apply countering transform to keep the scene centered in the panel content
          sceneTransformWrapper.setAttribute(
            'style',
            `transform: translate(${panelWidth / 2}px, ${panelHeight / 2}px) scale(${scene.scale})`
          );

          scene.updateSize(panelWidth, panelHeight);
          scene.panel.forceUpdate();
        }
      }}
    >
      <TransformComponent>
        {/* The <div> element has child elements that allow for mouse events, so we need to disable the linter rule */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onMouseDown={onSceneContainerMouseDown}>{sceneDiv}</div>
      </TransformComponent>
    </TransformWrapper>
  );
};
