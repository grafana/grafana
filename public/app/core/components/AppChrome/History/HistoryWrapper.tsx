import { css } from '@emotion/css';
import moment from 'moment';
import { useState } from 'react';

import { FieldType, GrafanaTheme2, store } from '@grafana/data';
import { Button, Card, IconButton, Space, Stack, Text, useStyles2, Box, Sparkline, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { HISTORY_LOCAL_STORAGE_KEY } from '../AppChromeService';
import { HistoryEntry } from '../types';

export function HistoryWrapper({ onClose }: { onClose: () => void }) {
  const history = store.getObject<HistoryEntry[]>(HISTORY_LOCAL_STORAGE_KEY, []);
  const [numItemsToShow, setNumItemsToShow] = useState(5);

  const onClickHistory = (url: string) => {
    window.location.href = url;
    onClose();
  };

  return (
    <Stack direction="column" alignItems="flex-start">
      <Box width="100%">
        {history.slice(0, numItemsToShow).map((entry, index) => (
          <HistoryEntryAppView key={index} entry={entry} isFirst={index === 0} onClick={onClickHistory} />
        ))}
      </Box>
      {history.length > numItemsToShow && (
        <Button variant="secondary" fill="text" onClick={() => setNumItemsToShow(numItemsToShow + 5)}>
          {t('nav.history.show-more', 'Show more')}
        </Button>
      )}
    </Stack>
  );
}
interface ItemProps {
  entry: HistoryEntry;
  isFirst: boolean;
  onClick: (url: string) => void;
}

function HistoryEntryAppView({ entry, isFirst, onClick }: ItemProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [isExpanded, setIsExpanded] = useState(isFirst && entry.views.length > 0);
  const { breadcrumbs, views, time, url, sparklineData } = entry;

  return (
    <Stack direction="column" gap={1}>
      <Stack>
        {views.length > 0 ? (
          <IconButton
            name={isExpanded ? 'angle-down' : 'angle-right'}
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="Expand / collapse"
            className={styles.iconButton}
          />
        ) : (
          <Space h={2} />
        )}

        <Card
          onClick={() => onClick(url)}
          isCompact={true}
          className={url === window.location.href ? undefined : styles.card}
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
          {views.map((view, index) => (
            <Card
              key={index}
              onClick={() => onClick(view.url)}
              isCompact={true}
              className={view.url === window.location.href ? undefined : styles.card}
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
          ))}
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
