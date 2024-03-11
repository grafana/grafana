// import { css } from '@emotion/css';
import React from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { ScalarDimensionConfig } from '@grafana/schema';
// import { useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions';
// import { ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';

interface TriangleData {}

interface TriangleConfig {}

const Triangle = ({ data }: CanvasElementProps<TriangleConfig, TriangleData>) => {
  // const styles = useStyles2(getStyles);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 160 160"
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
      <polygon stroke={defaultBgColor} points="0,0 160,80 0,160 " />
    </svg>
  );
};

export const triangleItem: CanvasElementItem = {
  id: 'triangle',
  name: 'Triangle',
  description: 'Triangle',

  display: Triangle,

  defaultSize: {
    width: 160,
    height: 160,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 160,
      height: options?.placement?.height ?? 160,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: TriangleConfig) => {
    const data: TriangleData = {};

    return data;
  },
};

// const getStyles = (theme: GrafanaTheme2) => ({
// });
