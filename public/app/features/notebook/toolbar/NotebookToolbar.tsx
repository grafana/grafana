import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, useStyles2 } from '@grafana/ui';

import { notebookShareUrl } from '../urls';

/**
 * The notebook view's header bar.
 */
export function NotebookToolbar({ uid }: { uid: string }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.toolbar}>
      <ClipboardButton variant="secondary" size="sm" icon="link" getText={() => notebookShareUrl(uid)}>
        {t('notebooks.view.copy-link', 'Copy link')}
      </ClipboardButton>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
});
