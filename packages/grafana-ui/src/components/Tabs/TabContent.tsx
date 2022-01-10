import React, { FC, HTMLAttributes, ReactNode } from 'react';
import { stylesFactory, useTheme2 } from '../../themes';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { TabListState } from '@react-stately/tabs';
import { useTabPanel } from '@react-aria/tabs';

interface Props extends HTMLAttributes<HTMLDivElement> {
  tabKey?: string;
  state?: TabListState<{}>;
}

const getTabContentStyle = stylesFactory((theme: GrafanaTheme2) => {
  return {
    tabContent: css`
      background: ${theme.colors.background.primary};
    `,
  };
});

export const TabContent: FC<Props> = ({ state, tabKey, className, ...restProps }) => {
  const theme = useTheme2();
  const styles = getTabContentStyle(theme);
  const ref = React.useRef(null);
  let { tabPanelProps } = useTabPanel({ id: tabKey }, state!, ref);

  return (
    <div {...restProps} {...tabPanelProps} className={cx(styles.tabContent, className)}>
      {state!.selectedItem?.props.children}
    </div>
  );
};
