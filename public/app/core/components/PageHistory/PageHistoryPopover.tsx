import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2, Text, TextLink } from '@grafana/ui';
import { Stack } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

import { HistoryEntryApp } from '../AppChrome/types';

export function PageHistoryPopover() {
  const styles = useStyles2(getStyles);
  const { history } = useGrafana().chrome.useState();

  return (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    //<div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
    <div className={styles.popover}>
      <div className={styles.heading}>History</div>
      <Stack direction="column" gap={0.5}>
        {history.map((entry, index) => (
          <HistoryEntryAppView key={index} entry={entry} />
        ))}
      </Stack>
    </div>
  );
}

interface ItemProps {
  entry: HistoryEntryApp;
}

function HistoryEntryAppView({ entry }: ItemProps) {
  const styles = useStyles2(getStyles);
  const [isExpanded, setIsExpanded] = useState(true);
  const currentUrl = window.location.href;

  // Hack to filter out the current page
  const views = entry.views.filter((view) => view.url !== currentUrl);
  if (views.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Stack>
        <IconButton
          name={isExpanded ? 'angle-up' : 'angle-down'}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label="Expand / collapse"
          className={styles.iconButton}
        />
        <Text weight="medium">{entry.name}</Text>
      </Stack>
      {isExpanded && (
        <div className={styles.expanded}>
          {views.map((view, index) => (
            <div key={index}>
              <TextLink href={view.url} inline={false}>
                {view.name}
              </TextLink>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    popover: css({
      display: 'flex',
      padding: theme.spacing(2),
      flexDirection: 'column',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.borderRadius(),
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: 1,
      marginRight: theme.spacing(2),
      minWidth: '300px',
    }),
    heading: css({
      display: 'none',
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(1),
    }),
    iconButton: css({
      margin: 0,
    }),
    expanded: css({
      display: 'flex',
      flexDirection: 'column',
      marginLeft: theme.spacing(3),
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
