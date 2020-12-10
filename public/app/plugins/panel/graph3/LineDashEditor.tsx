import React, { FC } from 'react';
import { css } from 'emotion';
import { stylesFactory } from '@grafana/ui';
import { GraphFieldConfig } from '@grafana/ui/src/components/uPlot/config';
import { GrafanaTheme, StandardEditorProps } from '@grafana/data';

export const LineDashEditor: FC<StandardEditorProps<number[] | undefined, any, GraphFieldConfig>> = ({
  value,
  onChange,
  context,
}) => {
  return <div>XXXXXX</div>;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  editorBox: css`
    label: editorBox;
    border: ${theme.border.width.sm} solid ${theme.colors.border2};
    border-radius: ${theme.border.radius.sm};
    margin: ${theme.spacing.xs} 0;
    width: 100%;
  `,
}));
