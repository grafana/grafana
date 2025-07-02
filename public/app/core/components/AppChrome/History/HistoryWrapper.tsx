import { css, cx } from '@emotion/css';
import moment from 'moment';
import { useState } from 'react';

import { FieldType, GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Card, IconButton, Space, Stack, Text, useStyles2, Box, Sparkline, useTheme2, Icon } from '@grafana/ui';
import { formatDate } from 'app/core/internationalization/dates';

import { HISTORY_LOCAL_STORAGE_KEY } from '../AppChromeService';
import { HistoryEntry } from '../types';

import { logClickUnifiedHistoryEntryEvent, logUnifiedHistoryShowMoreEvent } from './eventsTracking';

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
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" alignItems="flex-start">
      <Box width="100%">
        {Object.keys(hist).map((entries, date) => {
          return (
            <Stack key={date} direction="column" gap={1}>
              <Box paddingLeft={2}>
                <Text color="secondary">{entries}</Text>
              </Box>
              <div className={styles.timeline}>
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
              </div>
            </Stack>
          );
        })}
      </Box>
      {history.length > numItemsToShow && (
        <Box paddingLeft={2}>
          <Button
            variant="secondary"
            fill="text"
            onClick={() => {
              setNumItemsToShow(numItemsToShow + 5);
              logUnifiedHistoryShowMoreEvent();
            }}
          >
            {t('nav.history-wrapper.show-more', 'Show more')}
          </Button>
        </Box>
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

  return (
    <Box marginBottom={1}>
      <Stack direction="column" gap={1}>
        <Stack alignItems="baseline">
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
          <Icon
            size="sm"
            name={isSelected ? 'circle-mono' : 'circle'}
            aria-label={entryIconLabel}
            className={isExpanded ? styles.iconButtonDot : styles.iconButtonCircle}
          />
          <Card
            onClick={() => {
              store.setObject('CLICKING_HISTORY', true);
              onClick();
              logClickUnifiedHistoryEntryEvent({ entryURL: url });
            }}
            href={url}
            isCompact={true}
            className={isSelected ? styles.card : cx(styles.card, styles.cardSelected)}
          >
            <Stack direction="column">
              <div>
                {breadcrumbs.map((breadcrumb, index) => (
                  <Text key={index}>
                    {breadcrumb.text}{' '}
                    {index !== breadcrumbs.length - 1
                      ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                        '> '
                      : ''}
                  </Text>
                ))}
              </div>
              <Text variant="bodySmall" color="secondary">
                {formatDate(time, { timeStyle: 'short' })}
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
                    logClickUnifiedHistoryEntryEvent({ entryURL: view.url, subEntry: 'timeRange' });
                  }}
                  isCompact={true}
                  className={view.time === selectedViewTime ? undefined : styles.subCard}
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
    </Box>
  );
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      label: 'card',
      background: 'none',
      margin: theme.spacing(0.5, 0),
    }),
    cardSelected: css({
      label: 'card-selected',
      background: 'none',
    }),
    subCard: css({
      label: 'subcard',
      background: 'none',
      margin: 0,
    }),
    iconButton: css({
      label: 'expand-button',
      margin: 0,
    }),
    iconButtonCircle: css({
      label: 'blue-circle-icon',
      margin: 0,
      background: theme.colors.background.primary,
      fill: theme.colors.primary.main,
      cursor: 'default',
      '&:hover:before': {
        background: 'none',
      },
      //Need this to place the icon on the line, otherwise the line will appear on top of the icon
      zIndex: 0,
    }),
    iconButtonDot: css({
      label: 'blue-dot-icon',
      margin: 0,
      color: theme.colors.primary.main,
      border: theme.shape.radius.circle,
      cursor: 'default',
      '&:hover:before': {
        background: 'none',
      },
      //Need this to place the icon on the line, otherwise the line will appear on top of the icon
      zIndex: 0,
    }),
    expanded: css({
      label: 'expanded',
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
    timeline: css({
      label: 'timeline',
      position: 'relative',
      height: '100%',
      width: '100%',
      paddingLeft: theme.spacing(2),
      '&:before': {
        content: '""',
        position: 'absolute',
        left: theme.spacing(5.75),
        top: 0,
        height: '100%',
        width: '1px',
        borderLeft: `1px dashed ${theme.colors.border.strong}`,
      },
    }),
  };
};
