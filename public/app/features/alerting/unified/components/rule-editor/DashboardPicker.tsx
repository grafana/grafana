import { css, cx } from '@emotion/css';
import { noop } from 'lodash';
import { CSSProperties, useCallback, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import {
  Alert,
  Button,
  FilterInput,
  Icon,
  LoadingPlaceholder,
  Modal,
  Tooltip,
  clearButtonStyles,
  useStyles2,
} from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { DashboardModel } from '../../../../dashboard/state/DashboardModel';
import { dashboardApi } from '../../api/dashboardApi';

import { useDashboardQuery } from './useDashboardQuery';

export interface PanelDTO {
  id?: number;
  title?: string;
  type: string;
  collapsed?: boolean;
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
  dashboardUid?: string;
  panelId?: number;
  onChange: (dashboardUid: string, panelId: number) => void;
  onDismiss: () => void;
}

export const DashboardPicker = ({ dashboardUid, panelId, isOpen, onChange, onDismiss }: DashboardPickerProps) => {
  const styles = useStyles2(getPickerStyles);

  const [selectedDashboardUid, setSelectedDashboardUid] = useState(dashboardUid);
  const [selectedPanelId, setSelectedPanelId] = useState(panelId);

  const [dashboardFilter, setDashboardFilter] = useState('');
  const [debouncedDashboardFilter, setDebouncedDashboardFilter] = useState('');

  const [panelFilter, setPanelFilter] = useState('');
  const { useSearchQuery } = dashboardApi;

  const { currentData: filteredDashboards = [], isFetching: isDashSearchFetching } = useSearchQuery({
    query: debouncedDashboardFilter,
  });
  const { dashboardModel, isFetching: isDashboardFetching } = useDashboardQuery(selectedDashboardUid);

  const handleDashboardChange = useCallback((dashboardUid: string) => {
    setSelectedDashboardUid(dashboardUid);
    setSelectedPanelId(undefined);
  }, []);

  const allDashboardPanels = getVisualPanels(dashboardModel);

  const filteredPanels =
    allDashboardPanels
      .filter((panel) => panel.title?.toLowerCase().includes(panelFilter.toLowerCase()))
      .sort(panelSort) ?? [];

  const currentPanel: PanelDTO | undefined = allDashboardPanels.find(
    (panel: PanelDTO) => isValidPanel(panel) && panel.id?.toString() === selectedPanelId
  );

  const selectedDashboardIndex = useMemo(() => {
    return filteredDashboards.map((dashboard) => dashboard.uid).indexOf(selectedDashboardUid ?? '');
  }, [filteredDashboards, selectedDashboardUid]);

  const isDefaultSelection = dashboardUid && dashboardUid === selectedDashboardUid;
  const selectedDashboardIsInPageResult = selectedDashboardIndex >= 0;

  const scrollToItem = useCallback(
    (node: FixedSizeList) => {
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
      <button
        type="button"
        title={dashboard.title}
        style={style}
        className={cx(styles.rowButton, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => handleDashboardChange(dashboard.uid)}
      >
        <div className={cx(styles.dashboardTitle, styles.rowButtonTitle)}>{dashboard.title}</div>
        <div className={styles.dashboardFolder}>
          <Icon name="folder" /> {dashboard.folderTitle ?? 'Dashboards'}
        </div>
      </button>
    );
  };

  const PanelRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const panel = filteredPanels[index];
    const panelTitle = panel.title || '<No title>';
    const isSelected = Boolean(panel.id) && selectedPanelId === panel.id;
    const isAlertingCompatible = panel.type === 'graph' || panel.type === 'timeseries';
    const disabled = !isValidPanel(panel);

    return (
      <button
        type="button"
        style={style}
        disabled={disabled}
        className={cx(styles.rowButton, styles.panelButton, {
          [styles.rowOdd]: index % 2 === 1,
          [styles.rowSelected]: isSelected,
        })}
        onClick={() => (disabled ? noop : setSelectedPanelId(panel.id))}
      >
        <div className={styles.rowButtonTitle} title={panelTitle}>
          {panelTitle}
        </div>
        {!isAlertingCompatible && !disabled && (
          <Tooltip content="The alert tab and alert annotations are only supported on graph and timeseries panels.">
            <Icon name="exclamation-triangle" className={styles.warnIcon} data-testid="warning-icon" />
          </Tooltip>
        )}
        {disabled && (
          <Tooltip content="This panel does not have a valid identifier.">
            <Icon name="info-circle" data-testid="info-icon" />
          </Tooltip>
        )}
      </button>
    );
  };

  return (
    <Modal
      title={t('alerting.dashboard-picker.title-select-dashboard-and-panel', 'Select dashboard and panel')}
      closeOnEscape
      isOpen={isOpen}
      onDismiss={onDismiss}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      {/* This alert shows if the selected dashboard is not found in the first page of dashboards */}
      {!selectedDashboardIsInPageResult && dashboardUid && dashboardModel && (
        <Alert
          title={t('alerting.dashboard-picker.title-current-selection', 'Current selection')}
          severity="info"
          topSpacing={0}
          bottomSpacing={1}
          className={styles.modalAlert}
        >
          <div>
            Dashboard: {dashboardModel.title} ({dashboardModel.uid}) in folder{' '}
            {dashboardModel.meta?.folderTitle ?? 'Dashboards'}
          </div>
          {currentPanel && (
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
          title={t('alerting.dashboard-picker.title-search-dashboard', 'Search dashboard')}
          placeholder={t('alerting.dashboard-picker.placeholder-search-dashboard', 'Search dashboard')}
          autoFocus
        />
        <FilterInput
          value={panelFilter}
          onChange={setPanelFilter}
          title={t('alerting.dashboard-picker.title-search-panel', 'Search panel')}
          placeholder={t('alerting.dashboard-picker.placeholder-search-panel', 'Search panel')}
        />

        <div className={styles.column}>
          {isDashSearchFetching && (
            <LoadingPlaceholder
              text={t('alerting.dashboard-picker.text-loading-dashboards', 'Loading dashboards...')}
              className={styles.loadingPlaceholder}
            />
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
              <div>
                <Trans i18nKey="alerting.dashboard-picker.select-dashboard-available-panels">
                  Select a dashboard to get a list of available panels
                </Trans>
              </div>
            </div>
          )}
          {isDashboardFetching && (
            <LoadingPlaceholder
              text={t('alerting.dashboard-picker.text-loading-dashboard', 'Loading dashboard...')}
              className={styles.loadingPlaceholder}
            />
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
        <Button type="button" variant="secondary" onClick={onDismiss} fill="text">
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
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
          <Trans i18nKey="alerting.dashboard-picker.confirm">Confirm</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

export function getVisualPanels(dashboardModel: DashboardModel | undefined) {
  if (!dashboardModel) {
    return [];
  }

  const panelsWithoutRows = dashboardModel.panels.filter((panel) => panel.type !== 'row');
  const panelsNestedInRows = dashboardModel.panels
    .filter((rowPanel) => rowPanel.collapsed)
    .flatMap((collapsedRow) => collapsedRow.panels ?? []);

  const allDashboardPanels = [...panelsWithoutRows, ...panelsNestedInRows];
  return allDashboardPanels;
}

const isValidPanel = (panel: PanelDTO): boolean => {
  const hasValidID = typeof panel.id === 'number';
  const isValidPanelType = typeof panel.type === 'string';
  const isLibraryPanel = 'libraryPanel' in panel;

  return hasValidID && (isValidPanelType || isLibraryPanel);
};

const getPickerStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    container: css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'min-content auto',
      gap: theme.spacing(2),
      flex: 1,
    }),
    column: css({
      flex: '1 1 auto',
    }),
    dashboardTitle: css({
      height: '22px',
      fontWeight: theme.typography.fontWeightBold,
    }),
    dashboardFolder: css({
      height: '20px',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      columnGap: theme.spacing(1),
      alignItems: 'center',
    }),
    rowButton: css(clearButton, {
      padding: theme.spacing(0.5),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      border: '2px solid transparent',

      '&:disabled': {
        cursor: 'not-allowed',
        color: theme.colors.text.disabled,
      },
    }),
    rowButtonTitle: css({
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    rowSelected: css({
      borderColor: theme.colors.primary.border,
    }),
    rowOdd: css({
      backgroundColor: theme.colors.background.secondary,
    }),
    panelButton: css({
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    loadingPlaceholder: css({
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }),
    selectDashboardPlaceholder: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      fontWeight: theme.typography.fontWeightBold,
    }),
    modal: css({
      height: '100%',
    }),
    modalContent: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    modalAlert: css({
      flexGrow: 0,
    }),
    warnIcon: css({
      fill: theme.colors.warning.main,
    }),
  };
};
