import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { createNotebookWithContent } from '../addPanel/addPanelToNotebook';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';
import { notebookViewUrl } from '../urls';

import { clearScratchpad, getScratchpad } from './scratchpadStore';

/**
 * Turns the draft into a real notebook and opens it. The draft is only cleared once the create
 * succeeds, so a failure leaves everything in place to retry.
 */
export async function promoteScratchpad(): Promise<string> {
  const { title, blocks } = getScratchpad();
  const notebookTitle = title.trim() || `Scratchpad ${dateTime().format('YYYY-MM-DD HH:mm')}`;

  const created = await createNotebookWithContent(
    { title: notebookTitle },
    blocks.map(({ id: _id, ...element }) => element),
    NOTEBOOK_ENTRY_POINT.QUICK_ADD
  );

  clearScratchpad();
  dispatch(
    notifyApp(
      createSuccessNotification(
        t('notebooks.scratchpad.saved', 'Saved as notebook {{title}}', {
          title: created.title,
          interpolation: { escapeValue: false },
        })
      )
    )
  );
  locationService.push(notebookViewUrl(created.uid));
  return created.uid;
}
