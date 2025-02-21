import { css } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { SelectableValue, GrafanaTheme2 } from '@grafana/data';

import { IconButton } from '../../components/IconButton/IconButton';
import { TabsBar, Tab, TabContent } from '../../components/Tabs';
import { useStyles2, useTheme2 } from '../../themes';
import { IconName } from '../../types/icon';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

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
  testId?: string;
}

export function TabbedContainer({ tabs, defaultTab, closeIconTooltip, onClose, testId }: TabbedContainerProps) {
  const [activeTab, setActiveTab] = useState(tabs.some((tab) => tab.value === defaultTab) ? defaultTab : tabs[0].value);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const onSelectTab = (item: SelectableValue<string>) => {
    setActiveTab(item.value!);
  };

  const autoHeight = `calc(100% - (${theme.spacing(theme.components.menuTabs.height)} + ${theme.spacing(1)}))`;

  return (
    <div className={styles.container} data-testid={testId}>
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
        <IconButton className={styles.close} onClick={onClose} name="times" tooltip={closeIconTooltip ?? 'Close'} />
      </TabsBar>
      <ScrollContainer height={autoHeight}>
        <TabContent className={styles.tabContent}>{tabs.find((t) => t.value === activeTab)?.content}</TabContent>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
  }),
  tabContent: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    height: `100%`,
  }),
  close: css({
    position: 'absolute',
    right: '16px',
    top: '5px',
    cursor: 'pointer',
    fontSize: theme.typography.size.lg,
  }),
  tabs: css({
    paddingTop: theme.spacing(1),
    borderColor: theme.colors.border.weak,
    ul: {
      marginLeft: theme.spacing(2),
    },
  }),
});
