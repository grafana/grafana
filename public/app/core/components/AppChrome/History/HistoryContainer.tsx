import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2, store } from '@grafana/data';
import { Drawer, ToolbarButton, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { HistoryChangedEvent } from 'app/types/events';

import { HISTORY_LOCAL_STORAGE_KEY } from '../AppChromeService';
import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';
import { HistoryEntryApp } from '../types';

import { HistoryWrapper } from './HistoryWrapper';

export function HistoryContainer() {
  const [showHistoryDrawer, onToggleShowHistoryDrawer] = useToggle(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const sub = appEvents.subscribe(HistoryChangedEvent, (ev) => {
      const history = store.getObject<HistoryEntryApp[]>(HISTORY_LOCAL_STORAGE_KEY, []);
      let lastEntry = history[0];
      const newUrl = ev.payload.url;
      const lastUrl = lastEntry.views[0]?.url;
      if (lastUrl !== newUrl) {
        lastEntry.views = [
          {
            name: ev.payload.name,
            description: ev.payload.description,
            url: newUrl,
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
    <>
      <ToolbarButton onClick={onToggleShowHistoryDrawer} iconOnly icon="history" aria-label="History" />
      <NavToolbarSeparator className={styles.separator} />
      {showHistoryDrawer && (
        <Drawer title="History" onClose={onToggleShowHistoryDrawer} size="md">
          <HistoryWrapper />
        </Drawer>
      )}
    </>
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
