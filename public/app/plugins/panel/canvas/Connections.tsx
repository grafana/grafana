import React from 'react';

import { ConnectionPath } from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';

import { CONNECTION_ANCHOR_ALT, ConnectionAnchors, CONNECTION_ANCHOR_HIGHLIGHT_OFFSET } from './ConnectionAnchors';
import { ConnectionSVG } from './ConnectionSVG';
import { isConnectionSource, isConnectionTarget } from './utils';

export class Connections {
  scene: Scene;
  connectionAnchorDiv?: HTMLDivElement;
  connectionSVG?: SVGElement;
  connectionLine?: SVGLineElement;
  connectionSource?: ElementState;
  connectionTarget?: ElementState;
  isDrawingConnection?: boolean;
  didConnectionLeaveHighlight?: boolean;

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

  // Recursively find the first parent that is a canvas element
  findElementTarget = (element: Element): ElementState | undefined => {
    let elementTarget = undefined;

    // Cap recursion at the scene level
    if (element === this.scene.div) {
      return undefined;
    }

    elementTarget = this.scene.findElementByTarget(element);

    if (!elementTarget && element.parentElement) {
      elementTarget = this.findElementTarget(element.parentElement);
    }

    return elementTarget;
  };

  handleMouseEnter = (event: React.MouseEvent) => {
    if (!(event.target instanceof Element) || !this.scene.isEditingEnabled) {
      return;
    }

    let element: ElementState | undefined = this.findElementTarget(event.target);

    if (!element) {
      console.log('no element');
      return;
    }

    if (this.isDrawingConnection) {
      this.connectionTarget = element;
    } else {
      this.connectionSource = element;
      if (!this.connectionSource) {
        console.log('no connection source');
        return;
      }
    }

    const elementBoundingRect = element.div!.getBoundingClientRect();
    const parentBoundingRect = this.scene.div?.getBoundingClientRect();

    const relativeTop = elementBoundingRect.top - (parentBoundingRect?.top ?? 0);
    const relativeLeft = elementBoundingRect.left - (parentBoundingRect?.left ?? 0);

    if (this.connectionAnchorDiv) {
      this.connectionAnchorDiv.style.display = 'none';
      this.connectionAnchorDiv.style.display = 'block';
      this.connectionAnchorDiv.style.top = `${relativeTop}px`;
      this.connectionAnchorDiv.style.left = `${relativeLeft}px`;
      this.connectionAnchorDiv.style.height = `${elementBoundingRect.height}px`;
      this.connectionAnchorDiv.style.width = `${elementBoundingRect.width}px`;
    }
  };

  // Return boolean indicates if connection anchors were hidden or not
  handleMouseLeave = (event: React.MouseEvent | React.FocusEvent): boolean => {
    // If mouse is leaving INTO the anchor image, don't remove div
    if (
      event.relatedTarget instanceof HTMLImageElement &&
      event.relatedTarget.getAttribute('alt') === CONNECTION_ANCHOR_ALT
    ) {
      return false;
    }

    this.connectionTarget = undefined;
    this.connectionAnchorDiv!.style.display = 'none';
    return true;
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

    const connectionLineX1 = this.connectionLine.x1.baseVal.value;
    const connectionLineY1 = this.connectionLine.y1.baseVal.value;
    if (!this.didConnectionLeaveHighlight) {
      const connectionLength = Math.hypot(x - connectionLineX1, y - connectionLineY1);
      if (connectionLength > CONNECTION_ANCHOR_HIGHLIGHT_OFFSET && this.connectionSVG) {
        this.didConnectionLeaveHighlight = true;
        this.connectionSVG.style.display = 'block';
        this.isDrawingConnection = true;
      }
    }

    if (!event.buttons) {
      if (this.connectionSource && this.connectionSource.div && this.connectionSource.div.parentElement) {
        const sourceRect = this.connectionSource.div.getBoundingClientRect();
        const parentRect = this.connectionSource.div.parentElement.getBoundingClientRect();

        const sourceVerticalCenter = sourceRect.top - parentRect.top + sourceRect.height / 2;
        const sourceHorizontalCenter = sourceRect.left - parentRect.left + sourceRect.width / 2;

        // Convert from DOM coords to connection coords
        // TODO: Break this out into util function and add tests
        const sourceX = (connectionLineX1 - sourceHorizontalCenter) / (sourceRect.width / 2);
        const sourceY = (sourceVerticalCenter - connectionLineY1) / (sourceRect.height / 2);

        let targetX;
        let targetY;
        let targetName;

        if (this.connectionTarget && this.connectionTarget.div) {
          const targetRect = this.connectionTarget.div.getBoundingClientRect();

          const targetVerticalCenter = targetRect.top - parentRect.top + targetRect.height / 2;
          const targetHorizontalCenter = targetRect.left - parentRect.left + targetRect.width / 2;

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
        if (this.didConnectionLeaveHighlight) {
          this.connectionSource.options.connections = [...options.connections, connection];
          this.connectionSource.onChange(this.connectionSource.options);
        }
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

      const x = connectionStartTargetBox.x - parentBoundingRect.x + CONNECTION_ANCHOR_HIGHLIGHT_OFFSET;
      const y = connectionStartTargetBox.y - parentBoundingRect.y + CONNECTION_ANCHOR_HIGHLIGHT_OFFSET;

      const mouseX = clientX - parentBoundingRect.x;
      const mouseY = clientY - parentBoundingRect.y;

      this.connectionLine.setAttribute('x1', `${x}`);
      this.connectionLine.setAttribute('y1', `${y}`);
      this.connectionLine.setAttribute('x2', `${mouseX}`);
      this.connectionLine.setAttribute('y2', `${mouseY}`);
      this.didConnectionLeaveHighlight = false;
    }

    this.scene.selecto?.rootContainer?.addEventListener('mousemove', this.connectionListener);
  };

  // used for moveable actions
  connectionsNeedUpdate = (element: ElementState): boolean => {
    return isConnectionSource(element) || isConnectionTarget(element, this.scene.byName);
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
