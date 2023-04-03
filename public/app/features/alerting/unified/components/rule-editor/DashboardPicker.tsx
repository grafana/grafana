import { css, cx } from '@emotion/css';
import React, { CSSProperties, useCallback, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data/src';
import {
  FilterInput,
  LoadingPlaceholder,
  useStyles2,
  Icon,
  Modal,
  Button,
  Alert,
  clearButtonStyles,
  Tooltip,
} from '@grafana/ui';

import { dashboardApi } from '../../api/dashboardApi';

export interface PanelDTO {
  id: number;
  title?: string;
  type: string;
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
  isOpen: boolean;
  dashboardUid?: string | undefined;
  panelId?: string | undefined;
  onChange: (dashboardUid: string, panelId: string) => void;
  onDismiss: () => void;
}

export const DashboardPicker = ({ dashboardUid, panelId, isOpen, onChange, onDismiss }: DashboardPickerProps) => {
  const styles = useStyles2(getPickerStyles);

  const [selectedDashboardUid, setSelectedDashboardUid] = useState(dashboardUid);
  const [selectedPanelId, setSelectedPanelId] = useState(panelId);

  const [dashboardFilter, setDashboardFilter] = useState('');
  const [debouncedDashboardFilter, setDebouncedDashboardFilter] = useState('');

  const [panelFilter, setPanelFilter] = useState('');
  const { useSearchQuery, useDashboardQuery } = dashboardApi;

  const { currentData: filteredDashboards = [], isFetching: isDashSearchFetching } = useSearchQuery({
    query: debouncedDashboardFilter,
  });
  const { currentData: dashboardResult, isFetching: isDashboardFetching } = useDashboardQuery(
    { uid: selectedDashboardUid ?? '' },
    { skip: !selectedDashboardUid }
  );

  const handleDashboardChange = useCallback((dashboardUid: string) => {
    setSelectedDashboardUid(dashboardUid);
    setSelectedPanelId(undefined);
  }, []);

  const filteredPanels =
    dashboardResult?.dashboard?.panels
      ?.filter((panel): panel is PanelDTO => typeof panel.id === 'number' && typeof panel.type === 'string')
      ?.filter((panel) => panel.title?.toLowerCase().includes(panelFilter.toLowerCase()))
      .sort(panelSort) ?? [];

  const currentPanel = dashboardResult?.dashboard?.panels?.find((panel) => panel.id.toString() === selectedPanelId);

  const selectedDashboardIndex = useMemo(() => {
    return filteredDashboards.map((dashboard) => dashboard.uid).indexOf(selectedDashboardUid ?? '');
  }, [filteredDashboards, selectedDashboardUid]);

  const isDefaultSelection = dashboardUid && dashboardUid === selectedDashboardUid;
  const selectedDashboardIsInPageResult = selectedDashboardIndex >= 0;

  const scrollToItem = useCallback(
    (node) => {
      const canScroll = selectedDashboardIndex >= 0;

      if (isDefaultSelection && canScroll) {
        node?.scrollToItem(selectedDashboardIndex, 'smart');
      }
    },
    [isDefaultSelection, selectedDashboardIndex]
  );

  useDebounce(
    () => {
      setDebouncedDashboardFilter(dashboardFilter);
    },
    500,
    [dashboardFilter]
  );

  const DashboardRow = ({ index, style }: { index: number; style?: CSSProperties }) => {
    const dashboard = filteredDashboards[index];
    const isSelected = selectedDashboardUid === dashboard.uid;

    return (
      <div
        title={dashboard.title}
        style={style}
        className={cx(styles.rowButton, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => handleDashboardChange(dashboard.uid)}
      >
        <div className={cx(styles.dashboardTitle, styles.rowButtonTitle)}>{dashboard.title}</div>
        <div className={styles.dashboardFolder}>
          <Icon name="folder" /> {dashboard.folderTitle ?? 'General'}
        </div>
      </div>
    );
  };

  const PanelRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const panel = filteredPanels[index];
    const panelTitle = panel.title || '<No title>';
    const isSelected = selectedPanelId === panel.id.toString();
    const isAlertingCompatible = panel.type === 'graph' || panel.type === 'timeseries';

    return (
      <button
        style={style}
        className={cx(styles.rowButton, styles.panelButton, {
          [styles.rowOdd]: index % 2 === 1,
          [styles.rowSelected]: isSelected,
        })}
        onClick={() => setSelectedPanelId(panel.id.toString())}
      >
        <div className={styles.rowButtonTitle} title={panelTitle}>
          {panelTitle}
        </div>
        {!isAlertingCompatible && (
          <Tooltip content="Alert tab will be disabled for this panel. It is only supported on graph and timeseries panels">
            <Icon name="exclamation-triangle" className={styles.warnIcon} data-testid="warning-icon" />
          </Tooltip>
        )}
      </button>
    );
  };

  return (
    <Modal
      title="Select dashboard and panel"
      closeOnEscape
      isOpen={isOpen}
      onDismiss={onDismiss}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      {/* This alert shows if the selected dashboard is not found in the first page of dashboards */}
      {!selectedDashboardIsInPageResult && dashboardUid && (
        <Alert title="Current selection" severity="info" topSpacing={0} bottomSpacing={1} className={styles.modalAlert}>
          <div>
            Dashboard: {dashboardResult?.dashboard.title} ({dashboardResult?.dashboard.uid}) in folder{' '}
            {dashboardResult?.meta.folderTitle ?? 'General'}
          </div>
          {Boolean(currentPanel) && (
            <div>
              Panel: {currentPanel.title} ({currentPanel.id})
            </div>
          )}
        </Alert>
      )}
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
                <FixedSizeList
                  ref={scrollToItem}
                  itemSize={50}
                  height={height}
                  width={width}
                  itemCount={filteredDashboards.length}
                >
                  {DashboardRow}
                </FixedSizeList>
              )}
            </AutoSizer>
          )}
        </div>

        <div className={styles.column}>
          {!selectedDashboardUid && !isDashboardFetching && (
            <div className={styles.selectDashboardPlaceholder}>
              <div>Select a dashboard to get a list of available panels</div>
            </div>
          )}
          {isDashboardFetching && (
            <LoadingPlaceholder text="Loading dashboard..." className={styles.loadingPlaceholder} />
          )}

          {selectedDashboardUid && !isDashboardFetching && (
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
      <Modal.ButtonRow>
        <Button type="button" variant="secondary" onClick={onDismiss}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!(selectedDashboardUid && selectedPanelId)}
          onClick={() => {
            if (selectedDashboardUid && selectedPanelId) {
              onChange(selectedDashboardUid, selectedPanelId);
            }
          }}
        >
          Confirm
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const getPickerStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
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
    rowButton: css`
      ${clearButton};
      padding: ${theme.spacing(0.5)};
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
      border: 2px solid transparent;

      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.text.disabled};
      }
    `,
    rowButtonTitle: css`
      text-overflow: ellipsis;
      overflow: hidden;
    `,
    rowSelected: css`
      border-color: ${theme.colors.primary.border};
    `,
    rowOdd: css`
      background-color: ${theme.colors.background.secondary};
    `,
    panelButton: css`
      display: flex;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
      align-items: center;
    `,
    loadingPlaceholder: css`
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
    selectDashboardPlaceholder: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      font-weight: ${theme.typography.fontWeightBold};
    `,
    modal: css`
      height: 100%;
    `,
    modalContent: css`
      flex: 1;
      display: flex;
      flex-direction: column;
    `,
    modalAlert: css`
      flex-grow: 0;
    `,
    warnIcon: css`
      fill: ${theme.colors.warning.main};
    `,
  };
};
