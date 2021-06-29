import React, { FC } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { GeomapPanelOptions, MapViewConfig } from './types';

export const MapViewEditor: FC<StandardEditorProps<MapViewConfig, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return <div>View options here...</div>;
};

// const getStyles = stylesFactory((theme: GrafanaTheme) => ({
//   editorBox: css`
//     label: editorBox;
//     border: ${theme.border.width.sm} solid ${theme.colors.border2};
//     border-radius: ${theme.border.radius.sm};
//     margin: ${theme.spacing.xs} 0;
//     width: 100%;
//   `,
// }));
