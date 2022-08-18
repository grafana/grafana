import { css } from '@emotion/css';
import React, { useState } from 'react';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';

import { IconName, TabsBar, Tab, IconButton, CustomScrollbar, TabContent } from '../..';
import { stylesFactory, useTheme2 } from '../../themes';

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
    tabContent: css`
      padding: ${theme.spacing(2)};
      background-color: ${theme.colors.background.primary};
      height: calc(100% - ${theme.components.menuTabs.height}px);
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
    <div className={styles.container}>
      <TabsBar className={styles.tabs}>
        {tabs.map((t) => (
          <Tab
            key={t.value}
            label={t.label}
            active={t.value === activeTab}
            onChangeTab={() => onSelectTab(t)}
            icon={t.icon}
          />
        ))}
        <IconButton className={styles.close} onClick={onClose} name="times" title={closeIconTooltip ?? 'Close'} />
      </TabsBar>
      <CustomScrollbar autoHeightMin="100%">
        <TabContent className={styles.tabContent}>{tabs.find((t) => t.value === activeTab)?.content}</TabContent>
      </CustomScrollbar>
    </div>
  );
}
