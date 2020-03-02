import React, { FC } from 'react';
import { css } from 'emotion';
import { Icon, selectThemeVariant, stylesFactory, Tab, TabsBar, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { InspectTab } from './PanelInspector';
import { PanelModel } from '../../state';

interface Props {
  tab: InspectTab;
  tabs: Array<{ label: string; value: InspectTab }>;
  stats: { requestTime: number; queries: number; dataSources: number };
  panel: PanelModel;
  isExpanded: boolean;

  onSelectTab: (tab: SelectableValue<InspectTab>) => void;
  onClose: () => void;
  onToggleExpand: () => void;
}

export const InspectHeader: FC<Props> = ({
  tab,
  tabs,
  onSelectTab,
  onClose,
  onToggleExpand,
  panel,
  stats,
  isExpanded,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.header}>
      <div className={styles.actions}>
        <div className={styles.iconWrapper} onClick={onToggleExpand}>
          <Icon name={isExpanded ? 'chevron-right' : 'chevron-left'} className={styles.icon} />
        </div>
        <div className={styles.iconWrapper} onClick={onClose}>
          <Icon name="times" className={styles.icon} />
        </div>
      </div>
      <div className={styles.titleWrapper}>
        <h3>{panel.title}</h3>
        <div>{formatStats(stats)}</div>
      </div>
      <TabsBar>
        {tabs.map((t, index) => {
          return (
            <Tab
              key={`${t.value}-${index}`}
              label={t.label}
              active={t.value === tab}
              onChangeTab={() => onSelectTab(t)}
            />
          );
        })}
      </TabsBar>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const headerBackground = selectThemeVariant({ dark: theme.colors.gray15, light: theme.colors.white }, theme.type);
  return {
    header: css`
      background-color: ${headerBackground};
      z-index: 1;
      flex-grow: 0;
      padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.lg};
    `,
    actions: css`
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: ${theme.spacing.md};
    `,
    iconWrapper: css`
      cursor: pointer;
      width: 25px;
      height: 100%;
      display: flex;
      flex-shrink: 0;
      justify-content: center;
    `,
    icon: css`
      font-size: ${theme.typography.size.lg};
    `,
    titleWrapper: css`
      margin-bottom: ${theme.spacing.lg};
    `,
  };
});

function formatStats(stats: { requestTime: number; queries: number; dataSources: number }) {
  const queries = `${stats.queries} ${stats.queries === 1 ? 'query' : 'queries'}`;
  const dataSources = `${stats.dataSources} ${stats.dataSources === 1 ? 'data source' : 'data sources'}`;
  const requestTime = `${stats.requestTime === -1 ? 'N/A' : stats.requestTime}ms`;

  return `${queries} - ${dataSources}  - ${requestTime}`;
}
