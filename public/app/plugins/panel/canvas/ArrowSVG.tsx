import { css } from '@emotion/css';
import React from 'react';

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

export const ArrowSVG = ({ setSVGRef, setLineRef, scene }: Props) => {
  const styles = useStyles2(getStyles);

  // TODO: memos? in scene?  only update when things actually change?
  // Flat list of all connections
  const findConnections = () => {
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
  };

  const renderConnections = () => {
    return findConnections().map((v, idx) => {
      return (
        <svg className={styles.connection} key={idx}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="0"
              refY="3.5"
              orient="auto"
              stroke="rgb(255,255,255)"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="rgb(255,255,255)" />
            </marker>
          </defs>
          <line
            style={{ stroke: 'rgb(255,255,255)', strokeWidth: 2 }}
            markerEnd="url(#arrowhead)"
            x1={10 + 10 * idx}
            x2={20 + 10 * idx}
            y1={30 + 10 * idx}
            y2={40 + 10 * idx}
          />
        </svg>
      );
    });
  };

  return (
    <>
      <svg ref={setSVGRef} className={styles.editorSVG}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
            stroke="rgb(255,255,255)"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="rgb(255,255,255)" />
          </marker>
        </defs>
        <line ref={setLineRef} style={{ stroke: 'rgb(255,255,255)', strokeWidth: 2 }} markerEnd="url(#arrowhead)" />
      </svg>
      {renderConnections()}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  // editor WIP
  editorSVG: css`
    position: absolute;
    pointer-events: none;
    width: 100%;
    height: 100%;
    display: none;
  `,
  connection: css`
    position: absolute;
    width: 100%;
    height: 100%;
  `,
});
