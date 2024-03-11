// import { css } from '@emotion/css';
import React from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { ScalarDimensionConfig } from '@grafana/schema';
// import { useStyles2 } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions';
// import { ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';

interface CloudData {}

interface CloudConfig {}

const Cloud = ({ data }: CanvasElementProps<CloudConfig, CloudData>) => {
  // const styles = useStyles2(getStyles);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 110 70"
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
        d="M 23 13 C -1 13 -7 33 12.2 37 C -7 45.8 14.6 65 30.2 57 C 41 73 77 73 89 57 C 113 57 113 41 98 33 C 113 17 89 1 68 9 C 53 -3 29 -3 23 13 Z"
        fill={defaultBgColor}
        stroke="rgb(0, 0, 0)"
        strokeMiterlimit="10"
        pointerEvents="all"
      />
    </svg>
  );
};

export const cloudItem: CanvasElementItem = {
  id: 'cloud',
  name: 'Cloud',
  description: 'Cloud',

  display: Cloud,

  defaultSize: {
    width: 110,
    height: 70,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 110,
      height: options?.placement?.height ?? 70,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: CloudConfig) => {
    const data: CloudData = {};

    return data;
  },
};

// const getStyles = (theme: GrafanaTheme2) => ({
// });
