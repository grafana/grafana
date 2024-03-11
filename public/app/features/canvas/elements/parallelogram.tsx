// import { css } from '@emotion/css';
import React from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { ScalarDimensionConfig } from '@grafana/schema';
// import { useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions';
// import { ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';

interface ParallelogramData {}

interface ParallelogramConfig {}

const Parallelogram = ({ data }: CanvasElementProps<ParallelogramConfig, ParallelogramData>) => {
  // const styles = useStyles2(getStyles);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 120 60"
      width="100%"
      height="100%"
      style={{
        stroke: defaultBgColor,
        fill: defaultBgColor,
        maxWidth: '100%',
        height: 'intrinsic',
      }}
      preserveAspectRatio="none"
    >
      <path
        d="M 0 60 L 20 0 L 120 0 L 100 60 Z"
        fill={defaultBgColor}
        stroke="rgb(0, 0, 0)"
        strokeMiterlimit="10"
        pointerEvents="all"
      />
    </svg>
  );
};

export const parallelogramItem: CanvasElementItem = {
  id: 'parallelogram',
  name: 'Parallelogram',
  description: 'Parallelogram',

  display: Parallelogram,

  defaultSize: {
    width: 120,
    height: 60,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 120,
      height: options?.placement?.height ?? 60,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ParallelogramConfig) => {
    const data: ParallelogramData = {};

    return data;
  },
};

// const getStyles = (theme: GrafanaTheme2) => ({
// });
