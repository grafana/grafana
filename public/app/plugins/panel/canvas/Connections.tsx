import React from 'react';

import { ConnectionPath } from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionAnchors } from './ConnectionAnchors';
import { ConnectionSVG } from './ConnectionSVG';

export class Connections {
  scene: Scene;
  connectionAnchorDiv?: HTMLDivElement;
  connectionSVG?: SVGElement;
  connectionLine?: SVGLineElement;
  connectionSource?: ElementState;
  connectionTarget?: ElementState;
  isDrawingConnection?: boolean;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  setConnectionAnchorRef = (anchorElement: HTMLDivElement) => {
    this.connectionAnchorDiv = anchorElement;
  };

  setConnectionSVGRef = (connectionSVG: SVGSVGElement) => {
    this.connectionSVG = connectionSVG;
  };

  setConnectionLineRef = (connectionLine: SVGLineElement) => {
    this.connectionLine = connectionLine;
  };

  handleMouseEnter = (event: React.MouseEvent) => {
    if (!(event.target instanceof HTMLElement) || !this.scene.isEditingEnabled) {
      return;
    }

    const element = event.target.parentElement?.parentElement;
    if (!element) {
      console.log('no element');
      return;
    }

    if (this.isDrawingConnection) {
      this.connectionTarget = this.scene.findElementByTarget(element);
    } else {
      this.connectionSource = this.scene.findElementByTarget(element);
      if (!this.connectionSource) {
        console.log('no connection source');
        return;
      }
    }

    const elementBoundingRect = element!.getBoundingClientRect();
    const parentBoundingRect = this.scene.div?.getBoundingClientRect();
    let parentBorderWidth = parseFloat(getComputedStyle(this.scene.div!).borderWidth);

    const relativeTop = elementBoundingRect.top - (parentBoundingRect?.top ?? 0) - parentBorderWidth;
    const relativeLeft = elementBoundingRect.left - (parentBoundingRect?.left ?? 0) - parentBorderWidth;

    if (this.connectionAnchorDiv) {
      this.connectionAnchorDiv.style.display = 'none';
      this.connectionAnchorDiv.style.display = 'block';
      this.connectionAnchorDiv.style.top = `${relativeTop}px`;
      this.connectionAnchorDiv.style.left = `${relativeLeft}px`;
      this.connectionAnchorDiv.style.height = `${elementBoundingRect.height}px`;
      this.connectionAnchorDiv.style.width = `${elementBoundingRect.width}px`;
    }
  };

  handleMouseLeave = (event: React.MouseEvent | React.FocusEvent) => {
    this.connectionAnchorDiv!.style.display = 'none';
  };

  connectionListener = (event: MouseEvent) => {
    event.preventDefault();

    if (!(this.connectionLine && this.scene.div && this.scene.div.parentElement)) {
      return;
    }

    const parentBoundingRect = this.scene.div.parentElement.getBoundingClientRect();
    const x = event.pageX - parentBoundingRect.x;
    const y = event.pageY - parentBoundingRect.y;

    this.connectionLine.setAttribute('x2', `${x}`);
    this.connectionLine.setAttribute('y2', `${y}`);

    if (!event.buttons) {
      if (this.connectionSource && this.connectionSource.div && this.connectionSource.div.parentElement) {
        const connectionLineX1 = this.connectionLine.x1.baseVal.value;
        const connectionLineY1 = this.connectionLine.y1.baseVal.value;

        const sourceRect = this.connectionSource.div.getBoundingClientRect();
        const parentRect = this.connectionSource.div.parentElement.getBoundingClientRect();
        const parentBorderWidth = parseFloat(getComputedStyle(this.connectionSource.div.parentElement).borderWidth);

        const sourceVerticalCenter = sourceRect.top - parentRect.top - parentBorderWidth + sourceRect.height / 2;
        const sourceHorizontalCenter = sourceRect.left - parentRect.left - parentBorderWidth + sourceRect.width / 2;

        // Convert from DOM coords to connection coords
        // TODO: Break this out into util function and add tests
        const sourceX = (connectionLineX1 - sourceHorizontalCenter) / (sourceRect.width / 2);
        const sourceY = (sourceVerticalCenter - connectionLineY1) / (sourceRect.height / 2);

        let targetX;
        let targetY;
        let targetName;

        if (this.connectionTarget && this.connectionTarget.div) {
          const targetRect = this.connectionTarget.div.getBoundingClientRect();

          const targetVerticalCenter = targetRect.top - parentRect.top - parentBorderWidth + targetRect.height / 2;
          const targetHorizontalCenter = targetRect.left - parentRect.left - parentBorderWidth + targetRect.width / 2;

          targetX = (x - targetHorizontalCenter) / (targetRect.width / 2);
          targetY = (targetVerticalCenter - y) / (targetRect.height / 2);
          targetName = this.connectionTarget.options.name;
        } else {
          const parentVerticalCenter = parentRect.height / 2;
          const parentHorizontalCenter = parentRect.width / 2;

          targetX = (x - parentHorizontalCenter) / (parentRect.width / 2);
          targetY = (parentVerticalCenter - y) / (parentRect.height / 2);
        }

        const connection = {
          source: {
            x: sourceX,
            y: sourceY,
          },
          target: {
            x: targetX,
            y: targetY,
          },
          targetName: targetName,
          color: 'white',
          size: 10,
          path: ConnectionPath.Straight,
        };

        const { options } = this.connectionSource;
        if (!options.connections) {
          options.connections = [];
        }
        this.connectionSource.options.connections = [...options.connections, connection];

        this.connectionSource.onChange(this.connectionSource.options);
      }

      if (this.connectionSVG) {
        this.connectionSVG.style.display = 'none';
      }

      if (this.scene.selecto && this.scene.selecto.rootContainer) {
        this.scene.selecto.rootContainer.style.cursor = 'default';
        this.scene.selecto.rootContainer.removeEventListener('mousemove', this.connectionListener);
      }

      this.isDrawingConnection = false;
    }
  };

  handleConnectionDragStart = (selectedTarget: HTMLElement, clientX: number, clientY: number) => {
    this.scene.selecto!.rootContainer!.style.cursor = 'crosshair';
    if (this.connectionSVG && this.connectionLine && this.scene.div && this.scene.div.parentElement) {
      const connectionStartTargetBox = selectedTarget.getBoundingClientRect();
      const parentBoundingRect = this.scene.div.parentElement.getBoundingClientRect();

      // TODO: Make this not as magic numbery -> related to the height / width of highlight ellipse
      const connectionAnchorHighlightOffset = 8;
      const x = connectionStartTargetBox.x - parentBoundingRect.x + connectionAnchorHighlightOffset;
      const y = connectionStartTargetBox.y - parentBoundingRect.y + connectionAnchorHighlightOffset;

      const mouseX = clientX - parentBoundingRect.x;
      const mouseY = clientY - parentBoundingRect.y;

      this.connectionLine.setAttribute('x1', `${x}`);
      this.connectionLine.setAttribute('y1', `${y}`);
      this.connectionLine.setAttribute('x2', `${mouseX}`);
      this.connectionLine.setAttribute('y2', `${mouseY}`);
      this.connectionSVG.style.display = 'block';

      this.isDrawingConnection = true;
    }

    this.scene.selecto?.rootContainer?.addEventListener('mousemove', this.connectionListener);
  };

  render() {
    return (
      <>
        <ConnectionAnchors setRef={this.setConnectionAnchorRef} handleMouseLeave={this.handleMouseLeave} />
        <ConnectionSVG setSVGRef={this.setConnectionSVGRef} setLineRef={this.setConnectionLineRef} scene={this.scene} />
      </>
    );
  }
}
