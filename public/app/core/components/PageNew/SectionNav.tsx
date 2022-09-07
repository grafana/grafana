import { css } from '@emotion/css';
import React from 'react';

import { NavModel, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon, VerticalTab, toIconName, CustomScrollbar } from '@grafana/ui';

export interface Props {
  model: NavModel;
}

export function SectionNav(props: Props) {
  const styles = useStyles2(getStyles);

  const main = props.model.main;
  const directChildren = props.model.main.children!.filter((x) => !x.hideFromTabs && !x.children);
  const nestedItems = props.model.main.children!.filter((x) => x.children && x.children.length);
  const icon = main.icon ? toIconName(main.icon) : undefined;

  return (
    <nav className={styles.nav}>
      <h2 className={styles.sectionName}>
        {icon && <Icon name={icon} size="lg" />}
        {main.img && <img className={styles.sectionImg} src={main.img} alt={`logo of ${main.text}`} />}
        {props.model.main.text}
      </h2>
      <CustomScrollbar>
        <div className={styles.items} role="tablist">
          {directChildren.map((child, index) => {
            return (
              !child.hideFromTabs &&
              !child.children && (
                <VerticalTab label={child.text} active={child.active} key={`${child.url}-${index}`} href={child.url} />
              )
            );
          })}
          {nestedItems.map((child) => (
            <>
              <div className={styles.subSection}>{child.text}</div>
              {child.children!.map((child, index) => {
                return (
                  !child.hideFromTabs &&
                  !child.children && (
                    <VerticalTab
                      label={child.text}
                      active={child.active}
                      key={`${child.url}-${index}`}
                      href={child.url}
                    />
                  )
                );
              })}
            </>
          ))}
        </div>
      </CustomScrollbar>
    </nav>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    nav: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.canvas,
      padding: theme.spacing(3, 2),
      flexShrink: 0,
      [theme.breakpoints.up('md')]: {
        width: '250px',
      },
    }),
    sectionName: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 0, 3, 0.25),
      fontSize: theme.typography.h4.fontSize,
      margin: 0,
    }),
    items: css({}),
    sectionImg: css({
      height: 48,
    }),
    subSection: css({
      padding: theme.spacing(3, 0, 0.5, 1),
      fontWeight: 500,
    }),
  };
};
