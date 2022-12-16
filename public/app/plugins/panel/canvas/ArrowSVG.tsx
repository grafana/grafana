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

      const x1 = sourceHorizontalCenter + (info.source.x * sourceRect.width) / 2;
      const y1 = sourceVerticalCenter - (info.source.y * sourceRect.height) / 2;

      // Change target to to be parent if no target instead of relative to source
      let x2;
      let y2;
      console.log('target', target);
      if (info.targetName) {
        // target stuff
      } else {
        // parent stuff
        const parentHorizontalCenter = parentRect.width / 2;
        const parentVerticalCenter = parentRect.height / 2;

        console.log(parentHorizontalCenter, parentVerticalCenter);

        x2 = parentHorizontalCenter + (info.target.x * parentRect.width) / 2;
        y2 = parentVerticalCenter - (info.target.y * parentRect.height) / 2;
      }

      console.log('x1', x1, 'y1', y1, 'x2', x2, 'y2', y2);

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
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
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
            id="editorArrowhead"
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
          ref={setLineRef}
          style={{ stroke: 'rgb(255,255,255)', strokeWidth: 2 }}
          markerEnd="url(#editorArrowhead)"
        />
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
