import React, { FC } from 'react';
import { css } from 'emotion';
import { stylesFactory, Tab, TabsBar, useTheme, IconButton } from '@grafana/ui';
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
        <IconButton name="angle-left" size="xl" onClick={onToggleExpand} surface="header" />
        <IconButton name="times" size="xl" onClick={onClose} surface="header" />
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
  const headerBackground = theme.isLight ? theme.palette.gray95 : theme.palette.gray15;
  return {
    header: css`
      background-color: ${headerBackground};
      z-index: 1;
      flex-grow: 0;
      padding-top: ${theme.spacing.sm};
    `,
    actions: css`
      position: absolute;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      right: ${theme.spacing.sm};
    `,
    tabsBar: css`
      padding-left: ${theme.spacing.md};
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
