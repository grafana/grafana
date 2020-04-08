import React, { FC } from 'react';
import { css } from 'emotion';
import { Icon, stylesFactory, Tab, TabsBar, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue, PanelData, getValueFormat, formattedValueToString } from '@grafana/data';
import { InspectTab } from './PanelInspector';
import { PanelModel } from '../../state';

interface Props {
  tab: InspectTab;
  tabs: Array<{ label: string; value: InspectTab }>;
  panelData: PanelData;
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
  panelData,
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
        <div className="muted">{formatStats(panelData)}</div>
      </div>
      <TabsBar className={styles.tabsBar}>
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
  const headerBackground = theme.isLight ? theme.colors.gray95 : theme.colors.gray15;
  return {
    header: css`
      background-color: ${headerBackground};
      z-index: 1;
      flex-grow: 0;
    `,
    actions: css`
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: ${theme.spacing.md};
    `,
    tabsBar: css`
      padding-left: ${theme.spacing.md};
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
      padding: ${theme.spacing.sm} ${theme.spacing.sm} 0 ${theme.spacing.lg};
    `,
  };
});

function formatStats(panelData: PanelData) {
  const { request } = panelData;
  if (!request) {
    return '';
  }

  const queryCount = request.targets.length;
  const requestTime = request.endTime ? request.endTime - request.startTime : 0;
  const formatted = formattedValueToString(getValueFormat('ms')(requestTime));

  return `${queryCount} queries with total query time of ${formatted}`;
}
