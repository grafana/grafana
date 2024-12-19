import { css } from '@emotion/css';
import moment from 'moment';
import { useState } from 'react';

import { FieldType, GrafanaTheme2, store } from '@grafana/data';
import { Button, Card, IconButton, Space, Stack, Text, useStyles2, Box, Sparkline, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { HISTORY_LOCAL_STORAGE_KEY } from '../AppChromeService';
import { HistoryEntry } from '../types';

export function HistoryWrapper({ onClose }: { onClose: () => void }) {
  const history = store.getObject<HistoryEntry[]>(HISTORY_LOCAL_STORAGE_KEY, []).filter((entry) => {
    return moment(entry.time).isAfter(moment().subtract(2, 'day').startOf('day'));
  });
  const [numItemsToShow, setNumItemsToShow] = useState(5);

  const selectedTime = history.find((entry) => {
    return entry.url === window.location.href || entry.views.some((view) => view.url === window.location.href);
  })?.time;

  const hist = history.slice(0, numItemsToShow).reduce((acc: { [key: string]: HistoryEntry[] }, entry) => {
    const date = moment(entry.time);
    let key = '';
    if (date.isSame(moment(), 'day')) {
      key = t('nav.history-wrapper.today', 'Today');
    } else if (date.isSame(moment().subtract(1, 'day'), 'day')) {
      key = t('nav.history-wrapper.yesterday', 'Yesterday');
    } else {
      key = date.format('YYYY-MM-DD');
    }
    acc[key] = [...(acc[key] || []), entry];
    return acc;
  }, {});

  return (
    <Stack direction="column" alignItems="flex-start">
      <Box width="100%">
        {Object.keys(hist).map((entries, date) => {
          return (
            <Stack key={date} direction="column" gap={1}>
              <Text color="secondary" variant="bodySmall">
                {entries}
              </Text>
              {hist[entries].map((entry, index) => {
                return (
                  <HistoryEntryAppView
                    key={index}
                    entry={entry}
                    isSelected={entry.time === selectedTime}
                    onClick={() => onClose()}
                  />
                );
              })}
            </Stack>
          );
        })}
      </Box>
      {history.length > numItemsToShow && (
        <Button variant="secondary" fill="text" onClick={() => setNumItemsToShow(numItemsToShow + 5)}>
          {t('nav.history-wrapper.show-more', 'Show more')}
        </Button>
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

  const selectedViewTime =
    isSelected &&
    entry.views.find((entry) => {
      return entry.url === window.location.href;
    })?.time;

  return (
    <Stack direction="column" gap={1}>
      <Stack>
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
            <div>
              {breadcrumbs.map((breadcrumb, index) => (
                <Text key={index}>
                  {breadcrumb.text} {index !== breadcrumbs.length - 1 ? '> ' : ''}
                </Text>
              ))}
            </div>
            <Text color="secondary">{moment(time).format('h:mm A')}</Text>
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
      margin: 0,
    }),
    expanded: css({
      display: 'flex',
      flexDirection: 'column',
      marginLeft: theme.spacing(5),
      gap: theme.spacing(1),
      position: 'relative',
      '&:before': {
        content: '""',
        position: 'absolute',
        left: theme.spacing(-2),
        top: 0,
        height: '100%',
        width: '1px',
        background: theme.colors.border.weak,
      },
    }),
  };
};
