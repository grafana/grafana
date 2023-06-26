import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { Scene } from 'app/features/canvas/runtime/scene';

import { ConnectionState } from '../../types';

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

  // @TODO revisit, currently returning last row index for field
  const getRowIndex = (fieldName: string | undefined) => {
    if (fieldName) {
      const series = scene.context.getPanelData()?.series[0];
      const field = series?.fields.find((f) => (f.name = fieldName));
      const data = field?.values;

      return data ? data.length - 1 : 0;
    }

    return 0;
  };

  // Figure out target and then target's relative coordinates drawing (if no target do parent)
  const renderConnections = () => {
    return scene.connections.state.map((v, idx) => {
      const { source, target, info } = v;
      const sourceRect = source.div?.getBoundingClientRect();
      const parent = source.div?.parentElement;
      const parentRect = parent?.getBoundingClientRect();

      if (!sourceRect || !parent || !parentRect) {
        return;
      }

      const sourceHorizontalCenter = sourceRect.left - parentRect.left + sourceRect.width / 2;
      const sourceVerticalCenter = sourceRect.top - parentRect.top + sourceRect.height / 2;

      // Convert from connection coords to DOM coords
      // TODO: Break this out into util function and add tests
      const x1 = sourceHorizontalCenter + (info.source.x * sourceRect.width) / 2;
      const y1 = sourceVerticalCenter - (info.source.y * sourceRect.height) / 2;

      let x2;
      let y2;

      if (info.targetName) {
        const targetRect = target.div?.getBoundingClientRect();

        const targetHorizontalCenter = targetRect!.left - parentRect.left + targetRect!.width / 2;
        const targetVerticalCenter = targetRect!.top - parentRect.top + targetRect!.height / 2;

        x2 = targetHorizontalCenter + (info.target.x * targetRect!.width) / 2;
        y2 = targetVerticalCenter - (info.target.y * targetRect!.height) / 2;
      } else {
        const parentHorizontalCenter = parentRect.width / 2;
        const parentVerticalCenter = parentRect.height / 2;

        x2 = parentHorizontalCenter + (info.target.x * parentRect.width) / 2;
        y2 = parentVerticalCenter - (info.target.y * parentRect.height) / 2;
      }

      const isSelected = selectedConnection === v && scene.panel.context.instanceState.selectedConnection;

      const strokeColor = info.color ? scene.context.getColor(info.color).value() : defaultArrowColor;
      const lastRowIndex = getRowIndex(info.size?.field);

      const strokeWidth = info.size ? scene.context.getScale(info.size).get(lastRowIndex) : defaultArrowSize;

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
