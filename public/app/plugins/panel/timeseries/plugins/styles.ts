import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';

import { AnnotationsDataFrameViewDTO } from './types';

export const getCommonAnnotationStyles = (theme: GrafanaTheme2) => {
  return (annotation?: AnnotationsDataFrameViewDTO) => {
    const color = theme.visualization.getColorByName(annotation?.color || DEFAULT_ANNOTATION_COLOR);
    return {
      markerTriangle: css`
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid ${color};
      `,
      markerBar: css`
        display: block;
        width: calc(100%);
        height: 5px;
        background: ${color};
      `,
    };
  };
};
