import React, { useState } from 'react';
import { css } from '@emotion/css';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '../../themes';
import { IconName, TabsBar, Tab, IconButton, CustomScrollbar, TabContent } from '../..';
import { Tabs } from './Tabs';
import { Item } from '@react-stately/collections';

export interface TabConfig {
  label: string;
  value: string;
  content: React.ReactNode;
  icon: IconName;
}

export interface TabbedContainerProps {
  tabs: TabConfig[];
  defaultTab?: string;
  closeIconTooltip?: string;
  onClose: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      height: 100%;
    `,
    close: css`
      position: absolute;
      right: 16px;
      top: 5px;
      cursor: pointer;
      font-size: ${theme.typography.size.lg};
    `,
    tabs: css`
      padding-top: ${theme.spacing(1)};
      border-color: ${theme.colors.border.weak};
      ul {
        margin-left: ${theme.spacing(2)};
      }
    `,
  };
});

export function TabbedContainer(props: TabbedContainerProps) {
  const [activeTab, setActiveTab] = useState(
    props.tabs.some((tab) => tab.value === props.defaultTab) ? props.defaultTab : props.tabs?.[0].value
  );

  const onSelectTab = (item: SelectableValue<string>) => {
    setActiveTab(item.value!);
  };

  const { tabs, onClose, closeIconTooltip } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <Tabs>
      {tabs.map((t) => (
        <Item key={t.value} title={t.value} aria-label={t.label}>
          {t.content}
        </Item>
      ))}
    </Tabs>
  );
}
