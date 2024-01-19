import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionState } from '../../types';
import { calculateCoordinates, getConnectionStyles, getParentBoundingClientRect } from '../../utils';

type Props = {
  setSVGRef: (anchorElement: SVGSVGElement) => void;
  setLineRef: (anchorElement: SVGLineElement) => void;
  scene: Scene;
};

let idCounter = 0;
const htmlElementTypes = ['input', 'textarea'];

export const ConnectionSVG = ({ setSVGRef, setLineRef, scene }: Props) => {
  const styles = useStyles2(getStyles);

  const headId = Date.now() + '_' + idCounter++;
  const CONNECTION_LINE_ID = useMemo(() => `connectionLineId-${headId}`, [headId]);
  const EDITOR_HEAD_ID = useMemo(() => `editorHead-${headId}`, [headId]);
  const defaultArrowColor = config.theme2.colors.text.primary;
  const defaultArrowSize = 2;

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
      const { source, target, info } = v;
      const sourceRect = source.div?.getBoundingClientRect();
      const parent = source.div?.parentElement;
      const transformScale = scene.scale;
      const parentRect = getParentBoundingClientRect(scene);

      if (!sourceRect || !parent || !parentRect) {
        return;
      }

      const { x1, y1, x2, y2 } = calculateCoordinates(sourceRect, parentRect, info, target, transformScale);

      const { strokeColor, strokeWidth } = getConnectionStyles(info, scene, defaultArrowSize);

      const isSelected = selectedConnection === v && scene.panel.context.instanceState.selectedConnection;

      const connectionCursorStyle = scene.isEditingEnabled ? 'grab' : '';
      const selectedStyles = { stroke: '#44aaff', strokeOpacity: 0.6, strokeWidth: strokeWidth + 5 };

      const CONNECTION_HEAD_ID = `connectionHead-${headId + Math.random()}`;

      return (
        <svg className={styles.connection} key={idx}>
          <g onClick={() => selectConnection(v)}>
            <defs>
              <marker
                id={CONNECTION_HEAD_ID}
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
              markerEnd={`url(#${CONNECTION_HEAD_ID})`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
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
});
