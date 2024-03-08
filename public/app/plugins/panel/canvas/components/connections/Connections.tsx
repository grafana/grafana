import React from 'react';
import { BehaviorSubject } from 'rxjs';

import { config } from '@grafana/runtime';
import { CanvasConnection, ConnectionPath } from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionState } from '../../types';
import {
  calculateCoordinates,
  getConnections,
  getParentBoundingClientRect,
  isConnectionSource,
  isConnectionTarget,
} from '../../utils';

import { CONNECTION_ANCHOR_ALT, ConnectionAnchors, CONNECTION_ANCHOR_HIGHLIGHT_OFFSET } from './ConnectionAnchors';
import { ConnectionSVG } from './ConnectionSVG';

export class Connections {
  scene: Scene;
  connectionAnchorDiv?: HTMLDivElement;
  connectionSVG?: SVGElement;
  connectionLine?: SVGLineElement;
  connectionSVGVertex?: SVGElement;
  connectionVertexPath?: SVGPathElement;
  connectionVertex?: SVGCircleElement;
  connectionSource?: ElementState;
  connectionTarget?: ElementState;
  isDrawingConnection?: boolean;
  vertexIndex?: number;
  didConnectionLeaveHighlight?: boolean;
  state: ConnectionState[] = [];
  readonly selection = new BehaviorSubject<ConnectionState | undefined>(undefined);

  constructor(scene: Scene) {
    this.scene = scene;
    this.updateState();
  }

  select = (connection: ConnectionState | undefined) => {
    if (connection === this.selection.value) {
      return;
    }
    this.selection.next(connection);
  };

  updateState = () => {
    const s = this.selection.value;
    this.state = getConnections(this.scene.byName);

    if (s) {
      for (let c of this.state) {
        if (c.source === s.source && c.index === s.index) {
          this.selection.next(c);
          break;
        }
      }
    }
  };

  setConnectionAnchorRef = (anchorElement: HTMLDivElement) => {
    this.connectionAnchorDiv = anchorElement;
  };

  setConnectionSVGRef = (connectionSVG: SVGSVGElement) => {
    this.connectionSVG = connectionSVG;
  };

  setConnectionLineRef = (connectionLine: SVGLineElement) => {
    this.connectionLine = connectionLine;
  };

  setConnectionSVGVertexRef = (connectionSVG: SVGSVGElement) => {
    this.connectionSVGVertex = connectionSVG;
  };

  setConnectionVertexRef = (connectionVertex: SVGCircleElement) => {
    this.connectionVertex = connectionVertex;
  };

  setConnectionVertexPathRef = (connectionVertexPath: SVGPathElement) => {
    this.connectionVertexPath = connectionVertexPath;
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
    const transformScale = this.scene.scale;
    const parentBoundingRect = getParentBoundingClientRect(this.scene);

    const relativeTop = elementBoundingRect.top - (parentBoundingRect?.top ?? 0);
    const relativeLeft = elementBoundingRect.left - (parentBoundingRect?.left ?? 0);

    if (this.connectionAnchorDiv) {
      this.connectionAnchorDiv.style.display = 'none';
      this.connectionAnchorDiv.style.display = 'block';
      this.connectionAnchorDiv.style.top = `${relativeTop / transformScale}px`;
      this.connectionAnchorDiv.style.left = `${relativeLeft / transformScale}px`;
      this.connectionAnchorDiv.style.height = `${elementBoundingRect.height / transformScale}px`;
      this.connectionAnchorDiv.style.width = `${elementBoundingRect.width / transformScale}px`;
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

    const transformScale = this.scene.scale;
    const parentBoundingRect = getParentBoundingClientRect(this.scene);

    if (!parentBoundingRect) {
      return;
    }

    const x = event.pageX - parentBoundingRect.x ?? 0;
    const y = event.pageY - parentBoundingRect.y ?? 0;

    this.connectionLine.setAttribute('x2', `${x / transformScale}`);
    this.connectionLine.setAttribute('y2', `${y / transformScale}`);

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

        const transformScale = this.scene.scale;
        const parentRect = getParentBoundingClientRect(this.scene);

        if (!parentRect) {
          return;
        }

        const sourceVerticalCenter = (sourceRect.top - parentRect.top + sourceRect.height / 2) / transformScale;
        const sourceHorizontalCenter = (sourceRect.left - parentRect.left + sourceRect.width / 2) / transformScale;

        // Convert from DOM coords to connection coords
        // TODO: Break this out into util function and add tests
        const sourceX = (connectionLineX1 - sourceHorizontalCenter) / (sourceRect.width / 2 / transformScale);
        const sourceY = (sourceVerticalCenter - connectionLineY1) / (sourceRect.height / 2 / transformScale);

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
          color: {
            fixed: config.theme2.colors.text.primary,
          },
          size: {
            fixed: 2,
            min: 1,
            max: 10,
          },
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
      this.updateState();
      this.scene.save();
    }
  };

  vertexListener = (event: MouseEvent) => {
    event.preventDefault();

    if (!(this.connectionVertex && this.scene.div && this.scene.div.parentElement)) {
      return;
    }

    const transformScale = this.scene.scale;
    const parentBoundingRect = getParentBoundingClientRect(this.scene);

    if (!parentBoundingRect) {
      return;
    }

    const x = event.pageX - parentBoundingRect.x ?? 0;
    const y = event.pageY - parentBoundingRect.y ?? 0;

    this.connectionVertex?.setAttribute('cx', `${x / transformScale}`);
    this.connectionVertex?.setAttribute('cy', `${y / transformScale}`);

    const sourceRect = this.selection.value!.source.div!.getBoundingClientRect();

    // calculate relative coordinates based on source and target coorindates of connection
    // TODO account for zoom properly
    const { x1, y1, x2, y2 } = calculateCoordinates(
      sourceRect,
      parentBoundingRect,
      this.selection.value?.info!,
      this.selection.value!.target,
      transformScale
    );

    let vx1 = x1;
    let vy1 = y1;
    let vx2 = x2;
    let vy2 = y2;
    if (this.selection.value && this.selection.value.vertices) {
      if (this.vertexIndex !== undefined && this.vertexIndex > 0) {
        vx1 += this.selection.value.vertices[this.vertexIndex - 1].x * (x2 - x1);
        vy1 += this.selection.value.vertices[this.vertexIndex - 1].y * (y2 - y1);
      }
      if (this.vertexIndex !== undefined && this.vertexIndex < this.selection.value.vertices.length - 1) {
        vx2 = this.selection.value.vertices[this.vertexIndex + 1].x * (x2 - x1) + x1;
        vy2 = this.selection.value.vertices[this.vertexIndex + 1].y * (y2 - y1) + y1;
      }
    }

    this.connectionVertexPath?.setAttribute(
      'd',
      `M${vx1 / transformScale} ${vy1 / transformScale} L${x / transformScale} ${y / transformScale} L${vx2 / transformScale} ${vy2 / transformScale}`
    );

    this.connectionSVGVertex!.style.display = 'block';

    if (!event.buttons) {
      this.scene.selecto?.rootContainer?.removeEventListener('mousemove', this.vertexListener);
      this.scene.selecto?.rootContainer?.removeEventListener('mouseup', this.vertexListener);
      this.scene.selecto!.rootContainer!.style.cursor = 'auto';
      this.connectionSVGVertex!.style.display = 'none';

      // call onChange here and update appropriate index of connection vertices array
      const connectionIndex = this.selection.value?.index;
      const vertexIndex = this.vertexIndex;

      if (connectionIndex !== undefined && vertexIndex !== undefined) {
        const currentSource = this.scene.connections.state[connectionIndex].source;
        if (currentSource.options.connections) {
          const currentConnections = [...currentSource.options.connections];
          if (currentConnections[connectionIndex].vertices) {
            const currentVertices = [...currentConnections[connectionIndex].vertices!];
            const currentVertex = { ...currentVertices[vertexIndex] };

            currentVertex.x = (x - x1) / (x2 - x1);
            currentVertex.y = (y - y1) / (y2 - y1);

            currentVertices[vertexIndex] = currentVertex;
            currentConnections[connectionIndex] = {
              ...currentConnections[connectionIndex],
              vertices: currentVertices,
            };

            currentSource.onChange({ ...currentSource.options, connections: currentConnections });

            this.updateState();
            this.scene.save();
          }
        }
      }
    }
  };

  handleConnectionDragStart = (selectedTarget: HTMLElement, clientX: number, clientY: number) => {
    this.scene.selecto!.rootContainer!.style.cursor = 'crosshair';
    if (this.connectionSVG && this.connectionLine && this.scene.div && this.scene.div.parentElement) {
      const connectionStartTargetBox = selectedTarget.getBoundingClientRect();

      const transformScale = this.scene.scale;
      const parentBoundingRect = getParentBoundingClientRect(this.scene);

      if (!parentBoundingRect) {
        return;
      }

      // Multiply by transform scale to calculate the correct scaled offset
      const connectionAnchorOffsetX = CONNECTION_ANCHOR_HIGHLIGHT_OFFSET * transformScale;
      const connectionAnchorOffsetY = CONNECTION_ANCHOR_HIGHLIGHT_OFFSET * transformScale;

      const x = (connectionStartTargetBox.x - parentBoundingRect.x + connectionAnchorOffsetX) / transformScale;
      const y = (connectionStartTargetBox.y - parentBoundingRect.y + connectionAnchorOffsetY) / transformScale;

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

  handleVertexDragStart = (selectedTarget: HTMLElement) => {
    this.vertexIndex = Number(selectedTarget.getAttribute('data-index'));
    this.scene.selecto!.rootContainer!.style.cursor = 'crosshair';

    this.scene.selecto?.rootContainer?.addEventListener('mousemove', this.vertexListener);
    this.scene.selecto?.rootContainer?.addEventListener('mouseup', this.vertexListener);
  };

  onChange = (current: ConnectionState, update: CanvasConnection) => {
    const connections = current.source.options.connections?.splice(0) ?? [];
    connections[current.index] = update;
    current.source.onChange({ ...current.source.options, connections });
    this.updateState();
  };

  // used for moveable actions
  connectionsNeedUpdate = (element: ElementState): boolean => {
    return isConnectionSource(element) || isConnectionTarget(element, this.scene.byName);
  };

  render() {
    return (
      <>
        <ConnectionAnchors setRef={this.setConnectionAnchorRef} handleMouseLeave={this.handleMouseLeave} />
        <ConnectionSVG
          setSVGRef={this.setConnectionSVGRef}
          setLineRef={this.setConnectionLineRef}
          setSVGVertexRef={this.setConnectionSVGVertexRef}
          setVertexPathRef={this.setConnectionVertexPathRef}
          setVertexRef={this.setConnectionVertexRef}
          scene={this.scene}
        />
      </>
    );
  }
}
