import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { ConnectionDirection } from 'app/features/canvas';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionCoordinates } from '../../panelcfg.gen';
import { ConnectionState } from '../../types';
import {
  calculateAbsoluteCoords,
  calculateAngle,
  calculateCoordinates,
  calculateDistance,
  calculateMidpoint,
  getConnectionStyles,
  getParentBoundingClientRect,
} from '../../utils';

import { CONNECTION_VERTEX_ADD_ID, CONNECTION_VERTEX_ID } from './Connections';

type Props = {
  setSVGRef: (anchorElement: SVGSVGElement) => void;
  setLineRef: (anchorElement: SVGLineElement) => void;
  setSVGVertexRef: (anchorElement: SVGSVGElement) => void;
  setVertexPathRef: (anchorElement: SVGPathElement) => void;
  setVertexRef: (anchorElement: SVGCircleElement) => void;
  scene: Scene;
};

let idCounter = 0;
const htmlElementTypes = ['input', 'textarea'];

export const ConnectionSVG = ({
  setSVGRef,
  setLineRef,
  setSVGVertexRef,
  setVertexPathRef,
  setVertexRef,
  scene,
}: Props) => {
  const styles = useStyles2(getStyles);

  const headId = Date.now() + '_' + idCounter++;
  const CONNECTION_LINE_ID = useMemo(() => `connectionLineId-${headId}`, [headId]);
  const EDITOR_HEAD_ID = useMemo(() => `editorHead-${headId}`, [headId]);
  const defaultArrowColor = config.theme2.colors.text.primary;
  const defaultArrowSize = 2;
  const defaultArrowDirection = ConnectionDirection.Forward;
  const maximumVertices = 10;

  const [selectedConnection, setSelectedConnection] = useState<ConnectionState | undefined>(undefined);

  // Need to use ref to ensure state is not stale in event handler
  const selectedConnectionRef = useRef(selectedConnection);
  useEffect(() => {
    selectedConnectionRef.current = selectedConnection;
  });

  useEffect(() => {
    if (scene.panel.context.instanceState?.selectedConnection) {
      setSelectedConnection(scene.panel.context.instanceState?.selectedConnection);
    }
  }, [scene.panel.context.instanceState?.selectedConnection]);

  const onKeyUp = (e: KeyboardEvent) => {
    const target = e.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (htmlElementTypes.indexOf(target.nodeName.toLowerCase()) > -1) {
      return;
    }

    // Backspace (8) or delete (46)
    if (e.keyCode === 8 || e.keyCode === 46) {
      if (selectedConnectionRef.current && selectedConnectionRef.current.source) {
        selectedConnectionRef.current.source.options.connections =
          selectedConnectionRef.current.source.options.connections?.filter(
            (connection) => connection !== selectedConnectionRef.current?.info
          );
        selectedConnectionRef.current.source.onChange(selectedConnectionRef.current.source.options);

        setSelectedConnection(undefined);
        scene.connections.select(undefined);
        scene.connections.updateState();
        scene.save();
      }
    } else {
      // Prevent removing event listener if key is not delete
      return;
    }

    document.removeEventListener('keyup', onKeyUp);
    scene.selecto!.rootContainer!.removeEventListener('click', clearSelectedConnection);
  };

  const clearSelectedConnection = (event: MouseEvent) => {
    const eventTarget = event.target;

    const shouldResetSelectedConnection = !(
      eventTarget instanceof SVGLineElement && eventTarget.id === CONNECTION_LINE_ID
    );

    if (shouldResetSelectedConnection) {
      setSelectedConnection(undefined);
      scene.connections.select(undefined);
    }
  };

  const selectConnection = (connection: ConnectionState) => {
    if (scene.isEditingEnabled) {
      setSelectedConnection(connection);
      scene.connections.select(connection);

      document.addEventListener('keyup', onKeyUp);
      scene.selecto!.rootContainer!.addEventListener('click', clearSelectedConnection);
    }
  };

  // Figure out target and then target's relative coordinates drawing (if no target do parent)
  const renderConnections = () => {
    return scene.connections.state.map((v, idx) => {
      const { source, target, info, vertices } = v;
      const sourceRect = source.div?.getBoundingClientRect();
      const parent = source.div?.parentElement;
      const transformScale = scene.scale;
      const parentRect = getParentBoundingClientRect(scene);

      if (!sourceRect || !parent || !parentRect) {
        return;
      }

      const { x1, y1, x2, y2 } = calculateCoordinates(sourceRect, parentRect, info, target, transformScale);
      const midpoint = calculateMidpoint(x1, y1, x2, y2);
      const xDist = x2 - x1;
      const yDist = y2 - y1;

      const { strokeColor, strokeWidth, strokeRadius, arrowDirection, lineStyle } = getConnectionStyles(
        info,
        scene,
        defaultArrowSize,
        defaultArrowDirection
      );

      const isSelected = selectedConnection === v && scene.panel.context.instanceState.selectedConnection;

      const connectionCursorStyle = scene.isEditingEnabled ? 'grab' : '';
      const selectedStyles = { stroke: '#44aaff', strokeOpacity: 0.6, strokeWidth: strokeWidth + 5 };

      const CONNECTION_HEAD_ID_START = `connectionHeadStart-${headId + Math.random()}`;
      const CONNECTION_HEAD_ID_END = `connectionHeadEnd-${headId + Math.random()}`;

      const radius = strokeRadius;
      // Create vertex path and populate array of add vertex controls
      const addVertices: ConnectionCoordinates[] = [];
      let pathString = `M${x1} ${y1} `;
      if (vertices?.length) {
        vertices.map((vertex, index) => {
          const x = vertex.x;
          const y = vertex.y;

          // Convert vertex relative coorindates to scene coordinates
          const X = x * xDist + x1;
          const Y = y * yDist + y1;

          // Coordinates for first arc control point
          let xa = x;
          let ya = y;

          // Coordinates for second arc control point
          let xb = x;
          let yb = y;

          let lHalfArc = 0;
          let angle1 = 0;
          let angle2 = 0;

          if (index < vertices.length - 1) {
            const Xn = vertices[index + 1].x * xDist + x1;
            const Yn = vertices[index + 1].y * yDist + y1;
            if (index === 0) {
              angle1 = calculateAngle(x1, y1, X, Y);
              angle2 = calculateAngle(X, Y, Xn, Yn);
            } else {
              const previousVertex = vertices[index - 1];
              const Xp = previousVertex.x * xDist + x1;
              const Yp = previousVertex.y * yDist + y1;
              angle1 = calculateAngle(Xp, Yp, X, Y);
              angle2 = calculateAngle(X, Y, Xn, Yn);
            }
          } else {
            let previousVertex = { x: 0, y: 0 };
            if (index > 0) {
              previousVertex = vertices[index - 1];
            }
            const Xp = previousVertex.x * xDist + x1;
            const Yp = previousVertex.y * yDist + y1;
            angle1 = calculateAngle(Xp, Yp, X, Y);
            angle2 = calculateAngle(X, Y, x2, y2);
          }
          const theta = angle2 - angle1; //radians
          const ccw = theta < 0;
          lHalfArc = radius * Math.tan(theta / 2);
          if (ccw) {
            lHalfArc *= -1;
          }

          if (index === 0) {
            // For first vertex
            addVertices.push(calculateMidpoint(0, 0, x, y));

            const lSegment = calculateDistance(X, Y, x1, y1);
            if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegment)) {
              // Limit curve control points to mid segment
              lHalfArc = 0.5 * lSegment;
            }
            const lDelta = lSegment - lHalfArc;
            xa = lDelta * Math.cos(angle1) + x1;
            ya = lDelta * Math.sin(angle1) + y1;
            xb = lHalfArc * Math.cos(angle2) + X;
            yb = lHalfArc * Math.sin(angle2) + Y;
          } else {
            // For all other vertices
            const previousVertex = vertices[index - 1];
            const Xp = previousVertex.x * xDist + x1;
            const Yp = previousVertex.y * yDist + y1;
            addVertices.push(calculateMidpoint(previousVertex.x, previousVertex.y, x, y));

            const lSegment = calculateDistance(X, Y, Xp, Yp);
            if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegment)) {
              // Limit curve control points to mid segment
              lHalfArc = 0.5 * lSegment;
            }
            let Xn = x2;
            let Yn = y2;
            if (index < vertices.length - 1) {
              const nextVertex = vertices[index + 1];
              Xn = nextVertex.x * xDist + x1;
              Yn = nextVertex.y * yDist + y1;
            }
            const lSegmentNext = calculateDistance(X, Y, Xn, Yn);
            if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegmentNext)) {
              lHalfArc = 0.5 * lSegmentNext;
            }
            const lDelta = lSegment - lHalfArc;

            xa = lDelta * Math.cos(angle1) + Xp;
            ya = lDelta * Math.sin(angle1) + Yp;
            xb = lHalfArc * Math.cos(angle2) + X;
            yb = lHalfArc * Math.sin(angle2) + Y;
          }
          if (index === vertices.length - 1) {
            // For last vertex
            addVertices.push(calculateMidpoint(1, 1, x, y));
          }
          pathString += `L${xa} ${ya} `;

          if (lHalfArc !== 0) {
            pathString += `Q ${X} ${Y} ${xb} ${yb} `;
          }
        });
        pathString += `L${x2} ${y2}`;
      }

      const markerStart =
        arrowDirection === ConnectionDirection.Reverse || arrowDirection === ConnectionDirection.Both
          ? `url(#${CONNECTION_HEAD_ID_START})`
          : undefined;

      const markerEnd =
        arrowDirection === ConnectionDirection.Forward || arrowDirection === ConnectionDirection.Both
          ? `url(#${CONNECTION_HEAD_ID_END})`
          : undefined;

      return (
        <svg className={styles.connection} key={idx}>
          <g onClick={() => selectConnection(v)}>
            <defs>
              <marker
                id={CONNECTION_HEAD_ID_START}
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
                stroke={strokeColor}
              >
                <polygon points="10 0, 0 3.5, 10 7" fill={strokeColor} />
              </marker>
              <marker
                id={CONNECTION_HEAD_ID_END}
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
                stroke={strokeColor}
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
              </marker>
            </defs>
            {vertices?.length ? (
              <g>
                <path
                  id={`${CONNECTION_LINE_ID}_transparent`}
                  d={pathString}
                  cursor={connectionCursorStyle}
                  pointerEvents="auto"
                  stroke="transparent"
                  strokeWidth={15}
                  fill={'none'}
                  style={isSelected ? selectedStyles : {}}
                />
                <path
                  d={pathString}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={lineStyle}
                  fill={'none'}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                />
                {isSelected && (
                  <g>
                    {vertices.map((value, index) => {
                      const { x, y } = calculateAbsoluteCoords(x1, y1, x2, y2, value.x, value.y);
                      return (
                        <circle
                          id={CONNECTION_VERTEX_ID}
                          data-index={index}
                          key={`${CONNECTION_VERTEX_ID}${index}_${idx}`}
                          cx={x}
                          cy={y}
                          r={5}
                          stroke={strokeColor}
                          className={styles.vertex}
                          cursor={'crosshair'}
                          pointerEvents="auto"
                        />
                      );
                    })}
                    {vertices.length < maximumVertices &&
                      addVertices.map((value, index) => {
                        const { x, y } = calculateAbsoluteCoords(x1, y1, x2, y2, value.x, value.y);
                        return (
                          <circle
                            id={CONNECTION_VERTEX_ADD_ID}
                            data-index={index}
                            key={`${CONNECTION_VERTEX_ADD_ID}${index}_${idx}`}
                            cx={x}
                            cy={y}
                            r={4}
                            stroke={strokeColor}
                            className={styles.addVertex}
                            cursor={'crosshair'}
                            pointerEvents="auto"
                          />
                        );
                      })}
                  </g>
                )}
              </g>
            ) : (
              <g>
                <line
                  id={`${CONNECTION_LINE_ID}_transparent`}
                  cursor={connectionCursorStyle}
                  pointerEvents="auto"
                  stroke="transparent"
                  strokeWidth={15}
                  style={isSelected ? selectedStyles : {}}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                />
                <line
                  id={CONNECTION_LINE_ID}
                  stroke={strokeColor}
                  pointerEvents="auto"
                  strokeWidth={strokeWidth}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                  strokeDasharray={lineStyle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  cursor={connectionCursorStyle}
                />
                {isSelected && (
                  <circle
                    id={CONNECTION_VERTEX_ADD_ID}
                    data-index={0}
                    cx={midpoint.x}
                    cy={midpoint.y}
                    r={4}
                    stroke={strokeColor}
                    className={styles.addVertex}
                    cursor={'crosshair'}
                    pointerEvents="auto"
                  />
                )}
              </g>
            )}
          </g>
        </svg>
      );
    });
  };

  return (
    <>
      <svg ref={setSVGRef} className={styles.editorSVG}>
        <defs>
          <marker
            id={EDITOR_HEAD_ID}
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            stroke={defaultArrowColor}
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={defaultArrowColor} />
          </marker>
        </defs>
        <line ref={setLineRef} stroke={defaultArrowColor} strokeWidth={2} markerEnd={`url(#${EDITOR_HEAD_ID})`} />
      </svg>
      <svg ref={setSVGVertexRef} className={styles.editorSVG}>
        <path
          ref={setVertexPathRef}
          stroke={defaultArrowColor}
          strokeWidth={2}
          strokeDasharray={'5, 5'}
          fill={'none'}
        />
        <circle ref={setVertexRef} stroke={defaultArrowColor} r={4} className={styles.vertex} />
      </svg>
      {renderConnections()}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorSVG: css({
    position: 'absolute',
    pointerEvents: 'none',
    width: '100%',
    height: '100%',
    zIndex: 1000,
    display: 'none',
  }),
  connection: css({
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1000,
    pointerEvents: 'none',
  }),
  vertex: css({
    fill: '#44aaff',
    strokeWidth: 2,
  }),
  addVertex: css({
    fill: '#44aaff',
    opacity: 0.5,
    strokeWidth: 1,
  }),
});
