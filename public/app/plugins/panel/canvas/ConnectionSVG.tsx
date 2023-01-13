import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { CanvasConnection } from 'app/features/canvas/element';
import { ElementState } from 'app/features/canvas/runtime/element';
import { Scene } from 'app/features/canvas/runtime/scene';

type Props = {
  setSVGRef: (anchorElement: SVGSVGElement) => void;
  setLineRef: (anchorElement: SVGLineElement) => void;
  scene: Scene;
};

interface ConnectionInfo {
  source: ElementState;
  target: ElementState;
  info: CanvasConnection;
}

export const ConnectionSVG = ({ setSVGRef, setLineRef, scene }: Props) => {
  const styles = useStyles2(getStyles);

  const CONNECTION_LINE_ID = 'connectionLineId';
  const CONNECTION_HEAD_ID = 'head';

  const [selectedConnection, setSelectedConnection] = useState<CanvasConnection | undefined>(undefined);

  // Need to use ref to ensure state is not stale in event handler
  const selectedConnectionRef = useRef(selectedConnection);
  useEffect(() => {
    selectedConnectionRef.current = selectedConnection;
  });

  const [selectedConnectionSource, setSelectedConnectionSource] = useState<ElementState | undefined>(undefined);
  const selectedConnectionSourceRef = useRef(selectedConnectionSource);
  useEffect(() => {
    selectedConnectionSourceRef.current = selectedConnectionSource;
  });

  const onKeyUp = (e: KeyboardEvent) => {
    // Backspace (8) or delete (46)
    if (e.keyCode === 8 || e.keyCode === 46) {
      if (selectedConnectionRef.current && selectedConnectionSourceRef.current) {
        selectedConnectionSourceRef.current.options.connections =
          selectedConnectionSourceRef.current.options.connections?.filter(
            (connection) => connection !== selectedConnectionRef.current
          );
        selectedConnectionSourceRef.current.onChange(selectedConnectionSourceRef.current.options);

        setSelectedConnection(undefined);
        setSelectedConnectionSource(undefined);
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
      setSelectedConnectionSource(undefined);
    }
  };

  const selectConnection = (connection: CanvasConnection, source: ElementState) => {
    if (scene.isEditingEnabled) {
      setSelectedConnection(connection);
      setSelectedConnectionSource(source);

      document.addEventListener('keyup', onKeyUp);
      scene.selecto!.rootContainer!.addEventListener('click', clearSelectedConnection);
    }
  };

  // Flat list of all connections
  const findConnections = useCallback(() => {
    const connections: ConnectionInfo[] = [];
    for (let v of scene.byName.values()) {
      if (v.options.connections) {
        for (let c of v.options.connections) {
          const target = c.targetName ? scene.byName.get(c.targetName) : v.parent;
          if (target) {
            connections.push({
              source: v,
              target,
              info: c,
            });
          }
        }
      }
    }
    return connections;
  }, [scene.byName]);

  // Figure out target and then target's relative coordinates drawing (if no target do parent)
  const renderConnections = () => {
    return findConnections().map((v, idx) => {
      const { source, target, info } = v;
      const sourceRect = source.div?.getBoundingClientRect();
      const parent = source.div?.parentElement;
      const parentRect = parent?.getBoundingClientRect();

      if (!sourceRect || !parent || !parentRect) {
        return;
      }

      const parentBorderWidth = parseFloat(getComputedStyle(parent).borderWidth);

      const sourceHorizontalCenter = sourceRect.left - parentRect.left - parentBorderWidth + sourceRect.width / 2;
      const sourceVerticalCenter = sourceRect.top - parentRect.top - parentBorderWidth + sourceRect.height / 2;

      // Convert from connection coords to DOM coords
      // TODO: Break this out into util function and add tests
      const x1 = sourceHorizontalCenter + (info.source.x * sourceRect.width) / 2;
      const y1 = sourceVerticalCenter - (info.source.y * sourceRect.height) / 2;

      let x2;
      let y2;

      if (info.targetName) {
        const targetRect = target.div?.getBoundingClientRect();

        const targetHorizontalCenter = targetRect!.left - parentRect.left - parentBorderWidth + targetRect!.width / 2;
        const targetVerticalCenter = targetRect!.top - parentRect.top - parentBorderWidth + targetRect!.height / 2;

        x2 = targetHorizontalCenter + (info.target.x * targetRect!.width) / 2;
        y2 = targetVerticalCenter - (info.target.y * targetRect!.height) / 2;
      } else {
        const parentHorizontalCenter = parentRect.width / 2;
        const parentVerticalCenter = parentRect.height / 2;

        x2 = parentHorizontalCenter + (info.target.x * parentRect.width) / 2;
        y2 = parentVerticalCenter - (info.target.y * parentRect.height) / 2;
      }

      const isSelected = selectedConnection === info;
      const selectedStyles = { stroke: '#44aaff', strokeWidth: 3 };
      const connectionCursorStyle = scene.isEditingEnabled ? 'grab' : '';

      return (
        <svg className={styles.connection} key={idx}>
          <g onClick={() => selectConnection(info, source)}>
            <defs>
              <marker
                id={CONNECTION_HEAD_ID}
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
                stroke="rgb(255,255,255)"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="rgb(255,255,255)" />
              </marker>
            </defs>
            <line
              id={`${CONNECTION_LINE_ID}_transparent`}
              cursor={connectionCursorStyle}
              stroke="transparent"
              pointerEvents="auto"
              strokeWidth={15}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
            <line
              id={CONNECTION_LINE_ID}
              stroke="rgb(255,255,255)"
              pointerEvents="auto"
              strokeWidth={2}
              markerEnd={`url(#${CONNECTION_HEAD_ID})`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              style={isSelected ? selectedStyles : {}}
              cursor={connectionCursorStyle}
            />
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
            id="editorHead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
            stroke="rgb(255,255,255)"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="rgb(255,255,255)" />
          </marker>
        </defs>
        <line ref={setLineRef} stroke="rgb(255,255,255)" strokeWidth={2} markerEnd="url(#editorHead)" />
      </svg>
      {renderConnections()}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editorSVG: css`
    position: absolute;
    pointer-events: none;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: none;
  `,
  connection: css`
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 1000;
    pointer-events: none;
  `,
});
