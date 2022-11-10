import { css, cx } from '@emotion/css';
import React, { CSSProperties, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data/src';
import { FilterInput, LoadingPlaceholder, useStyles2, Icon } from '@grafana/ui';

import { dashboardApi } from '../../api/dashboardApi';

export interface PanelDTO {
  id: number;
  title?: string;
}

function panelSort(a: PanelDTO, b: PanelDTO) {
  if (a.title && b.title) {
    return a.title.localeCompare(b.title);
  }
  if (a.title && !b.title) {
    return 1;
  } else if (!a.title && b.title) {
    return -1;
  }

  return 0;
}

interface DashboardPickerProps {
  dashboardUid?: string;
  panelId?: number;
  onDashboardChange: (uid: string | undefined) => void;
  onPanelChange: (id: number | undefined) => void;
}

export const DashboardPicker = ({ dashboardUid, panelId, onDashboardChange, onPanelChange }: DashboardPickerProps) => {
  const styles = useStyles2(getPickerStyles);

  const [dashboardFilter, setDashboardFilter] = useState('');
  const [debouncedDashboardFilter, setDebouncedDashboardFilter] = useState('');

  const [panelFilter, setPanelFilter] = useState('');

  const { useSearchQuery, useDashboardQuery } = dashboardApi;

  const { currentData: filteredDashboards = [], isFetching: isDashSearchFetching } = useSearchQuery({
    query: debouncedDashboardFilter,
  });
  const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery(
    { uid: dashboardUid ?? '' },
    { skip: !dashboardUid }
  );

  useDebounce(
    () => {
      setDebouncedDashboardFilter(dashboardFilter);
    },
    500,
    [dashboardFilter]
  );

  const handleDashboardChange = (dashboardUid: string) => {
    onDashboardChange(dashboardUid);
    onPanelChange(undefined);
  };

  const filteredPanels =
    dashboardResult?.dashboard?.panels
      ?.filter((panel): panel is PanelDTO => typeof panel.id === 'number')
      ?.filter((panel) => panel.title?.toLowerCase().includes(panelFilter.toLowerCase()))
      .sort(panelSort) ?? [];

  const DashboardRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const dashboard = filteredDashboards[index];
    const isSelected = dashboardUid === dashboard.uid;

    return (
      <div
        title={dashboard.title}
        style={style}
        className={cx(styles.row, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => handleDashboardChange(dashboard.uid)}
      >
        <div className={styles.dashboardTitle}>{dashboard.title}</div>
        <div className={styles.dashboardFolder}>
          <Icon name="folder" /> {dashboard.folderTitle ?? 'General'}
        </div>
      </div>
    );
  };

  const PanelRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const panel = filteredPanels[index];
    const isSelected = panelId === panel.id;

    return (
      <div
        style={style}
        className={cx(styles.row, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => onPanelChange(panel.id)}
      >
        {panel.title || '<No title>'}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <FilterInput
        value={dashboardFilter}
        onChange={setDashboardFilter}
        title="Search dashboard"
        placeholder="Search dashboard"
        autoFocus
      />
      <FilterInput value={panelFilter} onChange={setPanelFilter} title="Search panel" placeholder="Search panel" />

      <div className={styles.column}>
        {isDashSearchFetching && (
          <LoadingPlaceholder text="Loading dashboards..." className={styles.loadingPlaceholder} />
        )}

        {!isDashSearchFetching && (
          <AutoSizer>
            {({ height, width }) => (
              <FixedSizeList itemSize={50} height={height} width={width} itemCount={filteredDashboards.length}>
                {DashboardRow}
              </FixedSizeList>
            )}
          </AutoSizer>
        )}
      </div>

      <div className={styles.column}>
        {!dashboardUid && !isDashboardFetching && <div>Select a dashboard to get a list of available panels</div>}
        {isDashboardFetching && (
          <LoadingPlaceholder text="Loading dashboard..." className={styles.loadingPlaceholder} />
        )}
        {dashboardUid && !isDashboardFetching && (
          <AutoSizer>
            {({ width, height }) => (
              <FixedSizeList itemSize={32} height={height} width={width} itemCount={filteredPanels.length}>
                {PanelRow}
              </FixedSizeList>
            )}
          </AutoSizer>
        )}
      </div>
    </div>
  );
};

const getPickerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: min-content auto;
    gap: ${theme.spacing(2)};
    flex: 1;
  `,
  column: css`
    flex: 1 1 auto;
  `,
  dashboardTitle: css`
    height: 22px;
    font-weight: ${theme.typography.fontWeightBold};
  `,
  dashboardFolder: css`
    height: 20px;
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    column-gap: ${theme.spacing(1)};
    align-items: center;
  `,
  row: css`
    padding: ${theme.spacing(0.5)};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    border: 2px solid transparent;
  `,
  rowSelected: css`
    border-color: ${theme.colors.border.strong};
  `,
  rowOdd: css`
    background-color: ${theme.colors.background.secondary};
  `,
  loadingPlaceholder: css`
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
});
