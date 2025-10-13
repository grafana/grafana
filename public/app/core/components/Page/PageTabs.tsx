import { css } from '@emotion/css';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, TabsBar, Tab, toIconName } from '@grafana/ui';

export interface Props {
  navItem: NavModelItem;
}

export function PageTabs({ navItem }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.tabsWrapper}>
      <TabsBar>
        {navItem.children!.map((child, index) => {
          const icon = child.icon ? toIconName(child.icon) : undefined;
          return (
            !child.hideFromTabs && (
              <Tab
                label={child.text}
                active={child.active}
                key={`${child.url}-${index}`}
                icon={icon}
                counter={child.tabCounter}
                href={child.url}
                suffix={child.tabSuffix}
                onChangeTab={child.onClick}
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
