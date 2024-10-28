import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps } from '@grafana/scenes';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DataTrailCard } from './DataTrailCard';
import { DataTrailsHome } from './DataTrailsHome';
import { getTrailStore, getBookmarkKey } from './TrailStore/TrailStore';

interface Props extends SceneComponentProps<DataTrailsHome> {
  onDelete: (index: number) => void;
}

export function DataTrailsBookmarks({ model, onDelete }: Props) {
  const [toggleBookmark, setToggleBookmark] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <>
      {getTrailStore().bookmarks.length > 0 && (
        <>
          <div className={styles.horizontalLine} />
          <div className={css(styles.gap20, styles.bookmarkHeader, styles.bottomGap24)}>
            <div className={styles.header} style={{ marginRight: '16px' }}>
              <Trans i18nKey="trails.bookmarks.or-view-bookmarks">Or view bookmarks</Trans>
            </div>
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
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: `${theme.spacing(3)} 31px`,
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
      margin: '0 auto', // Center line horizontally
      marginTop: '32px',
    }),
  };
}
