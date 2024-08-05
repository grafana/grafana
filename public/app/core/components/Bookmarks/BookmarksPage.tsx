import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'app/types';

import { usePinnedItems } from '../AppChrome/MegaMenu/hooks';
import { findByUrl } from '../AppChrome/MegaMenu/utils';
import { NavLandingPageCard } from '../NavLandingPage/NavLandingPageCard';

export function BookmarksPage() {
  const styles = useStyles2(getStyles);
  const pinnedItems = usePinnedItems();
  const navTree = useSelector((state) => state.navBarTree);

  return (
    <Page navId="bookmarks">
      <Page.Contents>
        <section className={styles.grid}>
          {pinnedItems.map((url) => {
            const item = findByUrl(navTree, url);
            if (!item) {
              return null;
            }
            return (
              <NavLandingPageCard
                key={item.id || item.url}
                description={item.subTitle}
                text={item.text}
                url={item.url ?? ''}
              />
            );
          })}
        </section>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gap: theme.spacing(3),
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gridAutoRows: '138px',
    padding: theme.spacing(2, 0),
  }),
});
