import React, { FC } from 'react';
import { css } from 'emotion';
import { stylesFactory, Tab, TabsBar, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue, PanelData, getValueFormat, formattedValueToString } from '@grafana/data';
import { InspectTab } from './PanelInspector';

interface Props {
  tab: InspectTab;
  tabs: Array<{ label: string; value: InspectTab }>;
  panelData: PanelData;
  onSelectTab: (tab: SelectableValue<InspectTab>) => void;
}

export const InspectSubtitle: FC<Props> = ({ tab, tabs, onSelectTab, panelData }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      <div className="muted">{formatStats(panelData)}</div>
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
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    tabsBar: css`
      padding-left: ${theme.spacing.md};
      margin: ${theme.spacing.lg} -${theme.spacing.sm} -${theme.spacing.lg} -${theme.spacing.lg};
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
