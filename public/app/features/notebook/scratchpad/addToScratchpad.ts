import { t } from '@grafana/i18n';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { dispatch } from 'app/store/store';

import { addPanelErrorMessage } from '../addPanel/addPanelToNotebook';
import {
  shouldLockCapturedTimeRange,
  withCapturedTimeRange,
  type CapturedTimeRange,
} from '../addPanel/capturedTimeRange';
import { type PanelElement } from '../types';

import { addPanel } from './scratchpadStore';

interface Params {
  buildPanel: () => Promise<PanelElement>;
  capturedTimeRange: CapturedTimeRange;
  isLibraryPanel: boolean;
}

/** One-click add of a dashboard/Explore panel to the local draft. Same time-range rule as the notebook modal. */
export async function addPanelToScratchpad({ buildPanel, capturedTimeRange, isLibraryPanel }: Params): Promise<void> {
  try {
    const built = await buildPanel();
    const panel = shouldLockCapturedTimeRange(capturedTimeRange)
      ? withCapturedTimeRange(built, capturedTimeRange)
      : built;
    addPanel(panel, isLibraryPanel);
    dispatch(notifyApp(createSuccessNotification(t('notebooks.scratchpad.panel-added', 'Panel added to scratchpad'))));
  } catch (error) {
    dispatch(notifyApp(createErrorNotification(addPanelErrorMessage(error))));
  }
}
