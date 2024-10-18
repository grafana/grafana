import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { DataTrailCard } from './DataTrailCard';
import { getTrailStore, getBookmarkKey } from './TrailStore/TrailStore';

//refactored the commented out code in a subcomponent
// in the subcomponent we need 2 functions (2 values from the upper parent component - model and onDelete)
// we need button / click event. the click event will just call  toggleBookmark and turn it to !toggleBookmark aka setToggle(!toggle)

export function DataTrailsBookmarks({ model, onDelete }: any) {
  const [toggleBookmark, setToggleBookmark] = useState(false);
  const styles = useStyles2(getStyles);
  return (
    <>
      {getTrailStore().bookmarks.length > 0 && (
        <>
          <div className={styles.horizontalLine} />
          <div className={css(styles.gap20, styles.bookmarkHeader)}>
            <div className={styles.header}>Or view bookmarks</div>
            <IconButton
              name="angle-down"
              size="xxxl"
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
                    onSelect={() => model.onSelectBookmark(index)}
                    onDelete={() => onDelete(index)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    trailList: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)', // 3 columns
      gap: `${theme.spacing(3)} 31px`,
      alignItems: 'stretch', // vertically center cards in their boxes
      justifyItems: 'center',
    }),
    gap20: css({
      marginTop: theme.spacing(3),
      // marginBottom: '20px',
    }),
    bookmarkHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      // gap: theme.spacing(2),
    }),
    header: css({
      color: 'var(--text-primary, rgba(204, 204, 220, 0.7))',
      textAlign: 'center',
      /* H4 */
      fontFamily: 'Inter',
      fontSize: '18px',
      fontStyle: 'normal',
      fontWeight: '400',
      lineHeight: '22px' /* 122.222% */,
      letterSpacing: '0.045px',
    }),
    horizontalLine: css({
      width: '400px',
      height: '1px',
      background: 'rgba(204, 204, 220, 0.12)',
      margin: '0 auto', // Center the line horizontally
      marginTop: '32px',
    }),
  };
}
