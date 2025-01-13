import { css } from '@emotion/css';
import { useEffect } from 'react';

import { GrafanaTheme2, store } from '@grafana/data';
import { Drawer } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { RecordHistoryEntryEvent } from 'app/types/events';

import { AddonBarPane } from '../AddonBar/AddonBarPane';
import { HISTORY_LOCAL_STORAGE_KEY } from '../AppChromeService';
import { HistoryEntry } from '../types';

import { HistoryWrapper } from './HistoryWrapper';

export function HistoryContainer() {
  useEffect(() => {
    const sub = appEvents.subscribe(RecordHistoryEntryEvent, (ev) => {
      const clickedHistory = store.getObject<boolean>('CLICKING_HISTORY');
      if (clickedHistory) {
        store.setObject('CLICKING_HISTORY', false);
        return;
      }
      const history = store.getObject<HistoryEntry[]>(HISTORY_LOCAL_STORAGE_KEY, []);
      let lastEntry = history[0];
      const newUrl = ev.payload.url;
      const lastUrl = lastEntry.views[0]?.url;
      if (lastUrl !== newUrl) {
        lastEntry.views = [
          {
            name: ev.payload.name,
            description: ev.payload.description,
            url: newUrl,
            time: Date.now(),
          },
          ...lastEntry.views,
        ];
        store.setObject(HISTORY_LOCAL_STORAGE_KEY, [...history]);
      }
      return () => {
        sub.unsubscribe();
      };
    });
  }, []);

  return (
    <AddonBarPane title={t('nav.history-container.title', 'History')}>
      <HistoryWrapper />
    </AddonBarPane>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    separator: css({
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
  };
};
