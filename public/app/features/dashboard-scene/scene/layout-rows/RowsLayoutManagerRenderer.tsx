import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { useDashboardState } from '../../utils/utils';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { RowsLayoutManager } from './RowsLayoutManager';

export function RowLayoutManagerRenderer({ model }: SceneComponentProps<RowsLayoutManager>) {
  const { rows } = model.useState();
  const { isEditing } = useDashboardState(model);
  const styles = useStyles2(getStyles);
  const { hasCopiedRow } = useClipboardState();

  return (
    <div className={styles.wrapper}>
      {rows.map((row) => (
        <row.Component model={row} key={row.state.key!} />
      ))}
      {isEditing && (
        <div className="dashboard-canvas-add-button">
          <Button icon="plus" variant="primary" fill="text" onClick={() => model.addNewRow()}>
            <Trans i18nKey="dashboard.canvas-actions.new-row">New row</Trans>
          </Button>
          {hasCopiedRow && (
            <Button icon="plus" variant="primary" fill="text" onClick={() => model.pasteRow()}>
              <Trans i18nKey="dashboard.canvas-actions.paste-row">Paste row</Trans>
            </Button>
          )}
        </div>
      )}
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
