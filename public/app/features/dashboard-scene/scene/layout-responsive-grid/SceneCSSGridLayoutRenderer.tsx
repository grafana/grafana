import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { SceneCSSGridLayout, SceneCSSGridLayoutOptions } from './SceneCSSGridLayout';

export function SceneCSSGridLayoutRenderer({ model }: SceneComponentProps<SceneCSSGridLayout>) {
  const {
    children,
    isHidden,
    templateColumns,
    templateRows,
    autoRows,
    rowGap,
    columnGap,
    justifyItems,
    alignItems,
    justifyContent,
    md,
  } = model.useState();

  const styles = useStyles2(
    getStyles,
    templateColumns,
    templateRows,
    autoRows,
    rowGap,
    columnGap,
    justifyItems,
    alignItems,
    justifyContent,
    md
  );

  if (isHidden) {
    return null;
  }

  return (
    <div className={styles.container}>
      {children.map((item) => (
        <item.Component key={item.state.key} model={item} />
      ))}
    </div>
  );
}

const getStyles = (
  theme: GrafanaTheme2,
  templateColumns: CSSProperties['gridTemplateColumns'],
  templateRows: CSSProperties['gridTemplateRows'],
  autoRows: CSSProperties['gridAutoRows'],
  rowGap: number,
  columnGap: number,
  justifyItems: CSSProperties['justifyItems'],
  alignItems: CSSProperties['alignItems'],
  justifyContent: CSSProperties['justifyContent'],
  md: SceneCSSGridLayoutOptions | undefined
) => ({
  container: css({
    position: 'relative',
    display: 'grid',
    flexGrow: 1,
    gridTemplateColumns: templateColumns ?? 'unset',
    gridTemplateRows: templateRows ?? 'unset',
    gridAutoRows: autoRows ?? 'unset',
    rowGap: theme.spacing(rowGap ?? 1),
    columnGap: theme.spacing(columnGap ?? 1),
    justifyItems: justifyItems ?? 'unset',
    alignItems: alignItems ?? 'unset',
    justifyContent: justifyContent ?? 'unset',

    [theme.breakpoints.down('md')]: css({
      gridTemplateRows: md?.templateRows,
      gridTemplateColumns: md?.templateColumns,
      rowGap: md?.rowGap ? theme.spacing(md.rowGap) : undefined,
      columnGap: md?.columnGap ? theme.spacing(md.rowGap) : undefined,
      justifyItems: md?.justifyItems,
      alignItems: md?.alignItems,
      justifyContent: md?.justifyContent,
    }),
  }),
});
