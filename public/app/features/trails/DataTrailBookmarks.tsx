import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DataTrailCard } from './DataTrailCard';
import { getTrailStore, getBookmarkKey } from './TrailStore/TrailStore';

type Props = {
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
};

export function DataTrailsBookmarks({ onSelect, onDelete }: Props) {
  const [toggleBookmark, setToggleBookmark] = useState(() => {
    const savedState = localStorage.getItem('toggleBookmark');
    return savedState ? JSON.parse(savedState) : false;
  });
  const styles = useStyles2(getStyles);

  useEffect(() => {
    localStorage.setItem('toggleBookmark', JSON.stringify(toggleBookmark));
  }, [toggleBookmark]);

  if (getTrailStore().bookmarks.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.horizontalLine} />
      <div className={css(styles.gap20, styles.bookmarkHeader, styles.bottomGap24)}>
        <div className={styles.header} style={{ marginRight: '8px' }}>
          <Trans i18nKey="trails.bookmarks.or-view-bookmarks">Or view bookmarks</Trans>
        </div>
        <IconButton
          name={toggleBookmark ? 'angle-up' : 'angle-down'}
          size="xl"
          aria-label="bookmarkCarrot"
          variant="secondary"
          onClick={() => setToggleBookmark(!toggleBookmark)}
        />
      </div>
      {toggleBookmark && (
        <div className={styles.trailList}>
          {getTrailStore().bookmarks.map((bookmark, index) => {
            return (
              <DataTrailCard
                key={getBookmarkKey(bookmark)}
                bookmark={bookmark}
                onSelect={() => onSelect(index)}
                onDelete={() => onDelete(index)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    trailList: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: `${theme.spacing(4)}`,
      alignItems: 'stretch',
      justifyItems: 'center',
    }),
    gap20: css({
      marginTop: theme.spacing(3),
    }),
    bottomGap24: css({
      marginBottom: theme.spacing(3),
    }),
    bookmarkHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    }),
    header: css({
      color: theme.colors.text.primary,
      textAlign: 'center',
      fontSize: '18px',
      lineHeight: '22px',
      letterSpacing: '0.045px',
    }),
    horizontalLine: css({
      width: '400px',
      height: '1px',
      background: theme.colors.border.weak,
      margin: '0 auto', // Center line horizontally
      marginTop: '32px',
    }),
  };
}
