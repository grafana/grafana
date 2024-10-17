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
        {/* <svg xmlns="http://www.w3.org/2000/svg" width="25" height="24" viewBox="0 0 25 24" fill="none">
          <path
            d="M17.4999 9.17019C17.3126 8.98394 17.0591 8.87939 16.7949 8.87939C16.5308 8.87939 16.2773 8.98394 16.0899 9.17019L12.4999 12.7102L8.95995 9.17019C8.77259 8.98394 8.51913 8.87939 8.25495 8.87939C7.99076 8.87939 7.73731 8.98394 7.54995 9.17019C7.45622 9.26315 7.38183 9.37375 7.33106 9.49561C7.28029 9.61747 7.25415 9.74818 7.25415 9.88019C7.25415 10.0122 7.28029 10.1429 7.33106 10.2648C7.38183 10.3866 7.45622 10.4972 7.54995 10.5902L11.7899 14.8302C11.8829 14.9239 11.9935 14.9983 12.1154 15.0491C12.2372 15.0998 12.3679 15.126 12.4999 15.126C12.632 15.126 12.7627 15.0998 12.8845 15.0491C13.0064 14.9983 13.117 14.9239 13.2099 14.8302L17.4999 10.5902C17.5937 10.4972 17.6681 10.3866 17.7188 10.2648C17.7696 10.1429 17.7957 10.0122 17.7957 9.88019C17.7957 9.74818 17.7696 9.61747 17.7188 9.49561C17.6681 9.37375 17.5937 9.26315 17.4999 9.17019Z"
            fill="#CCCCDC"
            fillOpacity="0.65"
          />
        </svg> */}
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
      marginTop: theme.spacing(6), // ask catherine what the number should be
      marginBottom: '20px',
    }),
    bookmarkHeader: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(2),
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
      marginTop: '56px', // should be 32 but doing 24 + 32 right now to account for no show more button for recent metrics explorations
    }),
  };
}
