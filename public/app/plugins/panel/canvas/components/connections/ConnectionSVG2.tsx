import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { ConnectionDirection } from 'app/features/canvas/element';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionCoordinates } from '../../panelcfg.gen';
import { ConnectionState } from '../../types';
import {
  calculateAngle,
  calculateCoordinates2,
  calculateDistance,
  calculateMidpoint,
  getConnectionStyles,
} from '../../utils';

import { CONNECTION_VERTEX_ADD_ID, CONNECTION_VERTEX_ID } from './Connections';

type Props = {
  setLineRef: (anchorElement: SVGLineElement) => void;
  setVertexPathRef: (anchorElement: SVGPathElement) => void;
  setVertexRef: (anchorElement: SVGCircleElement) => void;
  setConnectionsSVGRef: (anchorElement: SVGSVGElement) => void;
  scene: Scene;
};

let idCounter = 0;
const htmlElementTypes = ['input', 'textarea'];

export const ConnectionSVG = ({ setLineRef, setVertexPathRef, setVertexRef, setConnectionsSVGRef, scene }: Props) => {
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
    return (
      scene.connections.state
        // Render selected connection last, ensuring it is above other connections
        .sort((_a, b) => (selectedConnection === b && scene.panel.context.instanceState.selectedConnection ? -1 : 0))
        .map((v, idx) => {
          const { source, target, info, vertices, index } = v;
          const sourceRect = source.div;
          const parent = source.div?.parentElement;
          const parentRect = scene.viewportDiv;

          if (!sourceRect || !parent || !parentRect) {
            return;
          }

          let { x1, y1, x2, y2 } = calculateCoordinates2(source, target, info);

          let { xStart, yStart, xEnd, yEnd } = { xStart: x1, yStart: y1, xEnd: x2, yEnd: y2 };
          if (v.sourceOriginal && v.targetOriginal) {
            xStart = v.sourceOriginal.x;
            yStart = v.sourceOriginal.y;
            xEnd = v.targetOriginal.x;
            yEnd = v.targetOriginal.y;
          } else if (source.options.connections) {
            // If original source or target coordinates are not set for the current connection, set them
            if (
              !source.options.connections[index].sourceOriginal ||
              !source.options.connections[index].targetOriginal
            ) {
              source.options.connections[index].sourceOriginal = { x: x1, y: y1 };
              source.options.connections[index].targetOriginal = { x: x2, y: y2 };
            }
          }

          const midpoint = calculateMidpoint(x1, y1, x2, y2);
          const xDist = xEnd - xStart;
          const yDist = yEnd - yStart;

          const { strokeColor, strokeWidth, strokeRadius, arrowDirection, lineStyle, shouldAnimate } =
            getConnectionStyles(info, scene, defaultArrowSize, defaultArrowDirection);

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
              const { x, y } = vertex;

              // Convert vertex relative coordinates to scene coordinates
              const X = x * xDist + xStart;
              const Y = y * yDist + yStart;

              // Initialize coordinates for first arc control point
              let xa = X;
              let ya = Y;

              // Initialize coordinates for second arc control point
              let xb = X;
              let yb = Y;

              // Initialize half arc distance and segment angles
              let lHalfArc = 0;
              let angle1 = 0;
              let angle2 = 0;

              // Only calculate arcs if there is a radius
              if (radius) {
                if (index < vertices.length - 1) {
                  const Xn = vertices[index + 1].x * xDist + xStart;
                  const Yn = vertices[index + 1].y * yDist + yStart;
                  if (index === 0) {
                    // First vertex
                    angle1 = calculateAngle(x1, y1, X, Y);
                    angle2 = calculateAngle(X, Y, Xn, Yn);
                  } else {
                    // All vertices
                    const previousVertex = vertices[index - 1];
                    const Xp = previousVertex.x * xDist + xStart;
                    const Yp = previousVertex.y * yDist + yStart;
                    angle1 = calculateAngle(Xp, Yp, X, Y);
                    angle2 = calculateAngle(X, Y, Xn, Yn);
                  }
                } else {
                  // Last vertex
                  if (index > 0) {
                    // Not also the first vertex
                    const previousVertex = vertices[index - 1];
                    const Xp = previousVertex.x * xDist + xStart;
                    const Yp = previousVertex.y * yDist + yStart;
                    angle1 = calculateAngle(Xp, Yp, X, Y);
                  } else {
                    angle1 = calculateAngle(x1, y1, X, Y);
                  }
                  angle2 = calculateAngle(X, Y, x2, y2);
                }

                // Calculate angle between two segments where arc will be placed
                const theta = angle2 - angle1; //radians
                // Attempt to determine if arc is counter clockwise (ccw)
                const ccw = theta < 0;
                // Half arc is used for arc control points
                lHalfArc = radius * Math.tan(theta / 2);
                if (ccw) {
                  lHalfArc *= -1;
                }
              }

              if (index === 0) {
                // For first vertex
                addVertices.push(
                  calculateMidpoint((x1 - xStart) / (xEnd - xStart), (y1 - yStart) / (yEnd - yStart), x, y)
                );

                // Only calculate arcs if there is a radius
                if (radius) {
                  // Length of segment
                  const lSegment = calculateDistance(X, Y, x1, y1);
                  if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegment)) {
                    // Limit curve control points to mid segment
                    lHalfArc = 0.5 * lSegment;
                  }
                  // Default next point to last point
                  let Xn = x2;
                  let Yn = y2;
                  if (index < vertices.length - 1) {
                    // Not also the last point
                    const nextVertex = vertices[index + 1];
                    Xn = nextVertex.x * xDist + xStart;
                    Yn = nextVertex.y * yDist + yStart;
                  }

                  // Length of next segment
                  const lSegmentNext = calculateDistance(X, Y, Xn, Yn);
                  if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegmentNext)) {
                    // Limit curve control points to mid segment
                    lHalfArc = 0.5 * lSegmentNext;
                  }
                  // Calculate arc control points
                  const lDelta = lSegment - lHalfArc;
                  xa = Math.round(lDelta * Math.cos(angle1) + x1);
                  ya = Math.round(lDelta * Math.sin(angle1) + y1);
                  xb = Math.round(lHalfArc * Math.cos(angle2) + X);
                  yb = Math.round(lHalfArc * Math.sin(angle2) + Y);

                  // Check if arc control points are inside of segment, otherwise swap sign
                  if ((xa > X && xa > x1) || (xa < X && xa < x1)) {
                    xa = (lDelta + 2 * lHalfArc) * Math.cos(angle1) + x1;
                    ya = (lDelta + 2 * lHalfArc) * Math.sin(angle1) + y1;
                    xb = -lHalfArc * Math.cos(angle2) + X;
                    yb = -lHalfArc * Math.sin(angle2) + Y;
                  }
                }
              } else {
                // For all other vertices
                const previousVertex = vertices[index - 1];
                addVertices.push(calculateMidpoint(previousVertex.x, previousVertex.y, x, y));

                // Only calculate arcs if there is a radius
                if (radius) {
                  // Convert previous vertex relative coorindates to scene coordinates
                  const Xp = previousVertex.x * xDist + xStart;
                  const Yp = previousVertex.y * yDist + yStart;

                  // Length of segment
                  const lSegment = calculateDistance(X, Y, Xp, Yp);
                  if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegment)) {
                    // Limit curve control points to mid segment
                    lHalfArc = 0.5 * lSegment;
                  }
                  // Default next point to last point
                  let Xn = x2;
                  let Yn = y2;
                  if (index < vertices.length - 1) {
                    // Not also the last point
                    const nextVertex = vertices[index + 1];
                    Xn = nextVertex.x * xDist + xStart;
                    Yn = nextVertex.y * yDist + yStart;
                  }

                  // Length of next segment
                  const lSegmentNext = calculateDistance(X, Y, Xn, Yn);
                  if (Math.abs(lHalfArc) > 0.5 * Math.abs(lSegmentNext)) {
                    // Limit curve control points to mid segment
                    lHalfArc = 0.5 * lSegmentNext;
                  }

                  // Calculate arc control points
                  const lDelta = lSegment - lHalfArc;
                  xa = Math.round(lDelta * Math.cos(angle1) + Xp);
                  ya = Math.round(lDelta * Math.sin(angle1) + Yp);
                  xb = Math.round(lHalfArc * Math.cos(angle2) + X);
                  yb = Math.round(lHalfArc * Math.sin(angle2) + Y);

                  // Check if arc control points are inside of segment, otherwise swap sign
                  if ((xa > X && xa > Xp) || (xa < X && xa < Xp)) {
                    xa = (lDelta + 2 * lHalfArc) * Math.cos(angle1) + Xp;
                    ya = (lDelta + 2 * lHalfArc) * Math.sin(angle1) + Yp;
                    xb = -lHalfArc * Math.cos(angle2) + X;
                    yb = -lHalfArc * Math.sin(angle2) + Y;
                  }
                }
              }
              if (index === vertices.length - 1) {
                // For last vertex only
                addVertices.push(
                  calculateMidpoint((x2 - xStart) / (xEnd - xStart), (y2 - yStart) / (yEnd - yStart), x, y)
                );
              }
              // Add segment to path
              pathString += `L${xa} ${ya} `;

              if (lHalfArc !== 0) {
                // Add arc if applicable
                pathString += `Q ${X} ${Y} ${xb} ${yb} `;
              }
            });
            // Add last segment
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

          const getAnimationDirection = () => {
            let values = '100;0';

            if (arrowDirection === ConnectionDirection.Reverse) {
              values = '0;100';
            }

            return values;
          };

          return (
            <g key={idx} onClick={() => selectConnection(v)}>
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
                // Render path with vertices
                <g>
                  {/* heighlight line */}
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
                  {/* real line */}
                  <path
                    d={pathString}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={lineStyle}
                    strokeDashoffset={1}
                    fill={'none'}
                    markerEnd={markerEnd}
                    markerStart={markerStart}
                  >
                    {shouldAnimate && (
                      <animate
                        attributeName="stroke-dashoffset"
                        values={getAnimationDirection()}
                        dur="5s"
                        calcMode="linear"
                        repeatCount="indefinite"
                        fill={'freeze'}
                      />
                    )}
                  </path>
                  {isSelected && (
                    <g>
                      {/* vertices */}
                      {vertices.map((value, index) => {
                        return (
                          <circle
                            id={CONNECTION_VERTEX_ID}
                            data-index={index}
                            key={`${CONNECTION_VERTEX_ID}${index}_${idx}`}
                            cx={value.x * xDist + xStart}
                            cy={value.y * yDist + yStart}
                            r={5}
                            stroke={strokeColor}
                            className={styles.vertex}
                            cursor={'crosshair'}
                            pointerEvents="auto"
                          />
                        );
                      })}
                      {/* midpoints */}
                      {vertices.length < maximumVertices &&
                        addVertices.map((value, index) => {
                          return (
                            <circle
                              id={CONNECTION_VERTEX_ADD_ID}
                              data-index={index}
                              key={`${CONNECTION_VERTEX_ADD_ID}${index}_${idx}`}
                              cx={value.x * xDist + xStart}
                              cy={value.y * yDist + yStart}
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
                // Render line without vertices
                <g>
                  {/* heighlight line */}
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
                  {/* real line */}
                  <line
                    id={CONNECTION_LINE_ID}
                    stroke={strokeColor}
                    pointerEvents="auto"
                    strokeWidth={strokeWidth}
                    markerEnd={markerEnd}
                    markerStart={markerStart}
                    strokeDasharray={lineStyle}
                    strokeDashoffset={1}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    cursor={connectionCursorStyle}
                  >
                    {shouldAnimate && (
                      <animate
                        attributeName="stroke-dashoffset"
                        values={getAnimationDirection()}
                        dur="5s"
                        calcMode="linear"
                        repeatCount="indefinite"
                        fill={'freeze'}
                      />
                    )}
                  </line>
                  {/* initial midpoint */}
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
          );
        })
    );
  };

  return (
    <>
      <svg ref={setConnectionsSVGRef} className={styles.connection}>
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
        {/* svg line for connection creation */}
        <line
          ref={setLineRef}
          stroke={defaultArrowColor}
          strokeWidth={2}
          markerEnd={`url(#${EDITOR_HEAD_ID})`}
          style={{ display: 'none' }}
        />

        {/* svg circle for initial vertex?
          path? is it for the line drag handling? */}
        <path
          ref={setVertexPathRef}
          stroke={defaultArrowColor}
          strokeWidth={2}
          strokeDasharray={'5, 5'}
          fill={'none'}
          style={{ display: 'none' }}
        />
        <circle
          ref={setVertexRef}
          stroke={defaultArrowColor}
          r={4}
          className={styles.vertex}
          style={{ display: 'none' }}
        />

        {renderConnections()}
      </svg>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  connection: css({
    position: 'absolute',
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
