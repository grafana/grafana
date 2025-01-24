import { css } from '@emotion/css';
import moment from 'moment';
import { useEffect, useState } from 'react';

import { FieldType, GrafanaTheme2, store } from '@grafana/data';
import { Button, Card, IconButton, Space, Stack, Text, useStyles2, Box, Sparkline, useTheme2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { t } from 'app/core/internationalization';
import { RecordHistoryEntryEvent } from 'app/types/events';

import { HistoryEntry } from '../types';

import { historyFormated } from './utils';

export function HistoryWrapper() {
  const { chrome } = useGrafana();
  const [numItemsToShow, setNumItemsToShow] = useState(5);
  const { history, historyDocked } = chrome.useState();
  const selectedTime = history.find((entry) => {
    return entry.url === window.location.href || entry.views.some((view) => view.url === window.location.href);
  })?.time;

  const hist = historyFormated(history, numItemsToShow);

  useEffect(() => {
    const sub = appEvents.subscribe(RecordHistoryEntryEvent, (ev) => {
      const clickedHistory = store.getObject<boolean>('CLICKING_HISTORY');
      if (clickedHistory) {
        store.setObject('CLICKING_HISTORY', false);
        return;
      }
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
        chrome.setHistory([...history]);
      }
    });
    return () => {
      sub.unsubscribe();
    };
  }, [chrome, history]);

  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" alignItems="flex-start">
      <Box width="100%">
        {Object.keys(hist).map((entries, date) => {
          return (
            <Stack key={date} direction="column" gap={1}>
              <span className={styles.paddingLeft}>
                <Text color="secondary">{entries}</Text>
              </span>
              <span key={date} className={styles.borderLeft}>
                {hist[entries].map((entry, index) => {
                  return (
                    <HistoryEntryAppView
                      key={index}
                      entry={entry}
                      isSelected={entry.time === selectedTime}
                      onClick={() => !historyDocked && chrome.setHistoryOpen(false)}
                    />
                  );
                })}
              </span>
            </Stack>
          );
        })}
      </Box>
      {history.length > numItemsToShow && (
        <span className={styles.paddingLeft}>
          <Button variant="secondary" fill="text" onClick={() => setNumItemsToShow(numItemsToShow + 5)}>
            {t('nav.history-wrapper.show-more', 'Show more')}
          </Button>
        </span>
      )}
    </Stack>
  );
}
interface ItemProps {
  entry: HistoryEntry;
  isSelected: boolean;
  onClick: () => void;
}

function HistoryEntryAppView({ entry, isSelected, onClick }: ItemProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [isExpanded, setIsExpanded] = useState(isSelected && entry.views.length > 0);
  const { breadcrumbs, views, time, url, sparklineData } = entry;
  const expandedLabel = isExpanded
    ? t('nav.history-wrapper.collapse', 'Collapse')
    : t('nav.history-wrapper.expand', 'Expand');
  const entryIconLabel = isExpanded
    ? t('nav.history-wrapper.icon-selected', 'Selected Entry')
    : t('nav.history-wrapper.icon-unselected', 'Normal Entry');
  const selectedViewTime =
    isSelected &&
    entry.views.find((entry) => {
      return entry.url === window.location.href;
    })?.time;

  const getBreadcrumbs = () => {
    let text = '';
    breadcrumbs.map((breadcrumb, index) => {
      text += `${breadcrumb.text} ${index !== breadcrumbs.length - 1 ? '> ' : ''}`;
    });
    return text;
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack alignItems={'baseline'}>
        <Stack direction="row">
          {views.length > 0 ? (
            <IconButton
              name={isExpanded ? 'angle-down' : 'angle-right'}
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={expandedLabel}
              className={styles.iconButton}
            />
          ) : (
            <Space h={2} />
          )}
          <IconButton
            size="sm"
            name={isSelected ? 'circle-mono' : 'circle'}
            onClick={() => {}}
            aria-label={entryIconLabel}
            className={styles.iconButtonCircle}
          />
        </Stack>
        <Card
          onClick={() => {
            store.setObject('CLICKING_HISTORY', true);
            onClick();
          }}
          href={url}
          isCompact={true}
          className={isSelected ? undefined : styles.card}
        >
          <Stack direction="column">
            <Text>{getBreadcrumbs()}</Text>
            <Text color="secondary" variant="bodySmall">
              {moment(time).format('h:mm A')}
            </Text>
            {sparklineData && (
              <Sparkline
                theme={theme}
                width={240}
                height={40}
                config={{
                  custom: {
                    fillColor: 'rgba(130, 181, 216, 0.1)',
                    lineColor: '#82B5D8',
                  },
                }}
                sparkline={{
                  y: {
                    type: FieldType.number,
                    name: 'test',
                    config: {},
                    values: sparklineData.values,
                    state: {
                      range: {
                        ...sparklineData.range,
                      },
                    },
                  },
                }}
              />
            )}
          </Stack>
        </Card>
      </Stack>
      {isExpanded && (
        <div className={styles.expanded}>
          {views.map((view, index) => {
            return (
              <Card
                key={index}
                href={view.url}
                onClick={() => {
                  store.setObject('CLICKING_HISTORY', true);
                  onClick();
                }}
                isCompact={true}
                className={view.time === selectedViewTime ? undefined : styles.card}
              >
                <Stack direction="column" gap={0}>
                  <Text variant="bodySmall">{view.name}</Text>
                  {view.description && (
                    <Text color="secondary" variant="bodySmall">
                      {view.description}
                    </Text>
                  )}
                </Stack>
              </Card>
            );
          })}
        </div>
      )}
    </Stack>
  );
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      background: 'none',
    }),
    iconButton: css({
      margin: theme.spacing(1, 0, 0, 0),
    }),
    iconButtonCircle: css({
      margin: theme.spacing(1, 0, 0, 0),
      color: theme.colors.primary.main,
    }),
    expanded: css({
      display: 'flex',
      flexDirection: 'column',
      marginLeft: theme.spacing(6),
      gap: theme.spacing(1),
      position: 'relative',
      '&:before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        height: '100%',
        width: '1px',
        background: theme.colors.border.weak,
      },
    }),
    borderLeft: css({
      position: 'relative',
      height: '100%',
      width: '100%',
      padding: theme.spacing(0, 2),
      '&:before': {
        content: '""',
        position: 'absolute',
        left: theme.spacing(6),
        top: 0,
        height: '100%',
        width: '1px',
        background: `repeating-linear-gradient(
          to bottom,
          ${theme.colors.border.strong},
          ${theme.colors.border.strong} 2px,
          transparent 2px,
          transparent 4px
        )`,
      },
    }),
    paddingLeft: css({
      paddingLeft: theme.spacing(2),
    }),
  };
};
