import { cx } from '@emotion/css';
import { FC } from 'react';

import { Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useTabs } from './TabbedPage.hooks';
import { getStyles } from './TabbedPage.styles';
import { TabbedPageProps } from './TabbedPage.types';
import { TabbedPageSelect } from './TabbedPageSelect';

export const TabbedPage: FC<TabbedPageProps> = ({ children, isLoading, vertical, ...props }) => {
  const tabs = useTabs(props.navId, props.navModel);
  const styles = useStyles2(getStyles, vertical);

  return (
    <Page {...props} className={cx(styles.Page, props.className)}>
      <Page.Contents isLoading={isLoading}>
        <TabsBar className={styles.TabsBar} hideBorder={vertical}>
          {tabs.map((child, index) => (
            <Tab
              aria-label={`Tab ${child.text}`}
              label={child.text}
              active={child.active}
              key={`${child.url}-${index}`}
              icon={child.icon}
              href={child.url}
              suffix={child.tabSuffix}
            />
          ))}
        </TabsBar>
        <TabbedPageSelect tabs={tabs} className={styles.TabSelect} />
        <div className={styles.PageBody}>{children}</div>
      </Page.Contents>
    </Page>
  );
};
