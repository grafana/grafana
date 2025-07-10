import { css } from '@emotion/css';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EmptyState, useStyles2 } from '@grafana/ui';
import { usePinnedItems } from 'app/core/components/AppChrome/MegaMenu/hooks';
import { findByUrl } from 'app/core/components/AppChrome/MegaMenu/utils';
import { NavLandingPageCard } from 'app/core/components/NavLandingPage/NavLandingPageCard';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'app/types/store';

export function BookmarksPage() {
  const styles = useStyles2(getStyles);
  const pinnedItems = usePinnedItems();
  const navTree = useSelector((state) => state.navBarTree);

  const validItems = pinnedItems.reduce((acc: NavModelItem[], url) => {
    const item = findByUrl(navTree, url);
    if (item) {
      acc.push(item);
    }
    return acc;
  }, []);

  return (
    <Page navId="bookmarks">
      <Page.Contents>
        {validItems.length === 0 ? (
          <EmptyState
            variant="call-to-action"
            message={t('bookmarks-page.empty.message', 'It looks like you haven’t created any bookmarks yet')}
          >
            <Trans i18nKey="bookmarks-page.empty.tip">
              Hover over any item in the nav menu and click on the bookmark icon to add it here.
            </Trans>
          </EmptyState>
        ) : (
          <section className={styles.grid}>
            {validItems.map((item) => {
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
        )}
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

export default BookmarksPage;
