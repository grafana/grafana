import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { RowsLayoutManager } from './RowsLayoutManager';

export function RowLayoutManagerRenderer({ model }: SceneComponentProps<RowsLayoutManager>) {
  const { rows } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {rows.map((row) => (
        <row.Component model={row} key={row.state.key!} />
      ))}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flexGrow: 1,
      width: '100%',
    }),
  };
}
