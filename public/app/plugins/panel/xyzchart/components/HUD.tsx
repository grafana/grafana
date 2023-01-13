import { css } from '@emotion/css';
import { Html } from '@react-three/drei';
import React, { useContext } from 'react';

import { ScatterPlotOptions } from '../models.gen';
import OptionsContext from '../optionsContext';
interface HUDProps {
  pointPos: THREE.Vector3;
  xValue: string;
  yValue: string;
  zValue: string;
}

export const HUD = ({ pointPos, xValue, yValue, zValue }: HUDProps) => {
  const options: ScatterPlotOptions = useContext(OptionsContext);
  const styles = getStyles(options);

  return (
    <Html
      position={pointPos}
      style={{
        transform: 'translate3d(-50%, -120%, 0)',
      }}
    >
      <div className={styles.tooltip}>
        <ul>
          <li>{xValue}</li>
          <li>{yValue}</li>
          <li>{zValue}</li>
        </ul>
      </div>
    </Html>
  );
};

const getStyles = (options: ScatterPlotOptions) => {
  return {
    tooltip: css`
      padding: 10px;
      background-color: ${options.hudBgColor};
      text-align: left;
      color: white;
      ul {
        list-style: none;
        display: inline-block;
        li {
          white-space: nowrap;
        }
      }
    `,
  };
};
