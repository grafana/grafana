import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ClipboardButton, Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';

import { NotebookExportMenu } from '../export/NotebookExportMenu';
import { type NotebookScene } from '../scene/NotebookScene';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';
import { notebookShareUrl } from '../urls';

/**
 * The notebook view's header bar.
 */
export function NotebookToolbar({ uid, scene }: { uid: string; scene: NotebookScene }) {
  const styles = useStyles2(getStyles);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Serialized from the scene rather than refetched: the page already holds the notebook, and this
  // way an export reflects what is on screen.
  const exportMenu = () => (
    <Menu>
      <NotebookExportMenu uid={uid} getSpec={async () => transformNotebookSceneToSaveModel(scene)} />
    </Menu>
  );

  return (
    <div className={styles.toolbar}>
      <ClipboardButton variant="secondary" size="sm" icon="link" getText={() => notebookShareUrl(uid)}>
        {t('notebooks.view.copy-link', 'Copy link')}
      </ClipboardButton>
      <Dropdown overlay={exportMenu} placement="bottom-end" onVisibleChange={setIsExportOpen}>
        <Button size="sm" variant="secondary" icon="download-alt" aria-haspopup="menu" aria-expanded={isExportOpen}>
          <Trans i18nKey="notebooks.export.label">Export</Trans>
          &nbsp;
          <Icon name={isExportOpen ? 'angle-up' : 'angle-down'} size="sm" aria-hidden="true" />
        </Button>
      </Dropdown>
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
