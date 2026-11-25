import { useAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { useFlagDashboardNotebookCreatePage } from '@grafana/runtime/internal';
import { Menu } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { NotebookAnalytics } from '../analytics/main';
import { NOTEBOOK_EXPORT_DESTINATION, NOTEBOOK_EXPORT_SOURCE } from '../analytics/types';
import { type Spec as NotebookSpec } from '../types';

import { type NotebookPageKind, notebookPageAssistantProps } from './openNotebookAsPage';

interface Props {
  uid: string;
  getSpec: () => Promise<NotebookSpec>;
  /** Saves edits still on autosave's debounce: the Skill reads the notebook back from the server. */
  flushPendingChanges: () => Promise<void>;
}

/**
 * "Create page with Assistant", with one child per kind of Page. Offered from the notebook page's
 * toolbar only, not the list's row menu.
 */
export function NotebookCreatePageMenuItem({ uid, getSpec, flushPendingChanges }: Props) {
  const notifyApp = useAppNotification();
  const createPageEnabled = useFlagDashboardNotebookCreatePage();
  const { isAvailable: assistantAvailable, openAssistant } = useAssistant();

  if (!createPageEnabled || !assistantAvailable || !openAssistant) {
    return null;
  }

  const onCreatePage = async (kind: NotebookPageKind) => {
    try {
      await flushPendingChanges();
      const spec = await getSpec();
      openAssistant(notebookPageAssistantProps(uid, spec, kind));
      NotebookAnalytics.exported(uid, NOTEBOOK_EXPORT_DESTINATION.PAGE, NOTEBOOK_EXPORT_SOURCE.NOTEBOOK_TOOLBAR);
    } catch (error) {
      notifyApp.error(t('notebooks.export.error', 'Failed to export notebook'));
    }
  };

  return (
    <>
      <Menu.Divider />
      <Menu.Item
        label={t('notebooks.create-page.menu', 'Create page with Assistant')}
        icon="ai-sparkle"
        childItems={[
          <Menu.Item
            key="presentation"
            label={t('notebooks.create-page.presentation', 'Presentation')}
            onClick={() => onCreatePage('presentation')}
          />,
          <Menu.Item
            key="exec-summary"
            label={t('notebooks.create-page.exec-summary', 'Exec summary')}
            onClick={() => onCreatePage('exec-summary')}
          />,
        ]}
      />
    </>
  );
}
