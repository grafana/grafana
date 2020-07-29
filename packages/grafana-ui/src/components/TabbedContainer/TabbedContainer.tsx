import React, { useState } from 'react';
import { css } from 'emotion';

import { SelectableValue, GrafanaTheme } from '@grafana/data';
import { stylesFactory, withTheme } from '../../themes';
import { IconName, Themeable, TabsBar, Tab, IconButton, CustomScrollbar, TabContent } from '../..';

export interface TabConfig {
  label: string;
  value: string;
  content: React.ReactNode;
  icon: IconName;
}

export interface TabbedContainerProps extends Themeable {
  tabs: TabConfig[];
  defaultTab?: string;
  onClose: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 100%;
    `,
    tabContent: css`
      padding: ${theme.spacing.md};
      background-color: ${theme.colors.bodyBg};
    `,
    close: css`
      position: absolute;
      right: 16px;
      top: 5px;
      cursor: pointer;
      font-size: ${theme.typography.size.lg};
    `,
    tabs: css`
      padding-top: ${theme.spacing.sm};
      border-color: ${theme.colors.formInputBorder};
      ul {
        margin-left: ${theme.spacing.md};
      }
    `,
    scrollbar: css`
      min-height: 100% !important;
      background-color: ${theme.colors.panelBg};
    `,
  };
});

function UnThemedTabbedContainer(props: TabbedContainerProps) {
  const [activeTab, setActiveTab] = useState(
    props.tabs.some(tab => tab.value === props.defaultTab) ? props.defaultTab : props.tabs?.[0].value
  );

  const onSelectTab = (item: SelectableValue<string>) => {
    setActiveTab(item.value!);
  };

  const { tabs, theme, onClose } = props;
  const styles = getStyles(theme);

  return (
    <div className={styles.container}>
      <TabsBar className={styles.tabs}>
        {tabs.map(t => (
          <Tab
            key={t.value}
            label={t.label}
            active={t.value === activeTab}
            onChangeTab={() => onSelectTab(t)}
            icon={t.icon}
          />
        ))}
        <IconButton className={styles.close} onClick={onClose} name="times" title="Close query history" />
      </TabsBar>
      <CustomScrollbar className={styles.scrollbar}>
        <TabContent className={styles.tabContent}>{tabs.find(t => t.value === activeTab)?.content}</TabContent>
      </CustomScrollbar>
    </div>
  );
}

export const TabbedContainer = withTheme(UnThemedTabbedContainer);
