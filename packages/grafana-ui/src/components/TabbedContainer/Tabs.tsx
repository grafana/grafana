import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTabListState } from '@react-stately/tabs';
import { SpectrumTabListProps } from '@react-types/tabs';
import { useTabList } from '@react-aria/tabs';
import { Tab } from '../Tabs/Tab';
import { TabsBar } from '../Tabs/TabsBar';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { TabContent } from '../Tabs/TabContent';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: any;
  active?: boolean;
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    tabContent: css`
      padding: ${theme.spacing(2)};
      background-color: ${theme.colors.background.primary};
      height: 100%;
    `,
    container: css`
      height: 100%;
    `,
    tabs: css`
      position: relative;
      display: flex;
      height: 41px;
    `,
  };
});

export const Tabs: FC<Props> = ({ children, className, ...restProps }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const state = useTabListState({ children: children });
  const tabsRef = React.useRef(null);
  let { tabListProps } = useTabList({ children: children }, state, tabsRef);

  return (
    <div {...restProps} className={styles.container}>
      <TabsBar tabListProps={tabListProps} ref={tabsRef} className={styles.tabs}>
        {[...state.collection].map((item) => (
          <Tab key={item.key} item={item} state={state} label={item['aria-label']} />
        ))}
      </TabsBar>
      <CustomScrollbar autoHeightMin="100%">
        <TabContent className={styles.tabContent} key={state.selectedItem?.key} state={state} />
      </CustomScrollbar>
    </div>
  );
};
