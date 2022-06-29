import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { IconName, useStyles2, TabsBar, Tab } from '@grafana/ui';

export interface Props {
  navItem: NavModelItem;
}

export function PageTabs({ navItem }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.tabsWrapper}>
      <TabsBar>
        {navItem.children!.map((child, index) => {
          return (
            !child.hideFromTabs && (
              <Tab
                label={child.text}
                active={child.active}
                key={`${child.url}-${index}`}
                icon={child.icon as IconName}
                href={child.url}
                suffix={child.tabSuffix}
              />
            )
          );
        })}
      </TabsBar>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tabsWrapper: css({
      paddingBottom: theme.spacing(3),
    }),
  };
};
