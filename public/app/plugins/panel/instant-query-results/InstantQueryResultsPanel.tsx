import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { memo, useMemo, useCallback } from 'react';

import { applyFieldOverrides, DataFrame, GrafanaTheme2, PanelProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { RadioButtonGroup, Table, usePanelContext, useStyles2, PanelChrome } from '@grafana/ui';
import { PANEL_BORDER } from 'app/core/constants';
import { MetaInfoText } from 'app/features/explore/MetaInfoText';
import RawListContainer from 'app/features/explore/PrometheusListView/RawListContainer';

import { DisplayMode, Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> {}

const getStyles = (_theme: GrafanaTheme2) => ({
  spacing: css({
    display: 'flex',
    justifyContent: 'space-between',
    flex: '1',
  }),
});

const DISPLAY_MODE_OPTIONS: Array<SelectableValue<DisplayMode>> = [
  { value: 'table', label: 'Table' },
  { value: 'raw', label: 'Raw' },
];

export const InstantQueryResultsPanel = memo(
  ({ data, options, width, onOptionsChange, fieldConfig, replaceVariables, timeZone }: Props) => {
    const styles = useStyles2(getStyles);
    const panelContext = usePanelContext();

    // Process data with field overrides (memoized)
    const processedData = useMemo(() => {
      const frames = data.series ?? [];
      if (!frames.length) {
        return frames;
      }

      // Clone to avoid mutating frozen data
      const cloned = cloneDeep(frames);
      return applyFieldOverrides({
        data: cloned,
        timeZone: timeZone ?? 'browser',
        theme: config.theme2,
        replaceVariables,
        fieldConfig,
        dataLinkPostProcessor: panelContext.dataLinkPostProcessor,
      });
    }, [data.series, timeZone, replaceVariables, fieldConfig, panelContext.dataLinkPostProcessor]);

    // Handle display mode toggle
    const onChangeDisplayMode = useCallback(
      (newMode: DisplayMode) => {
        reportInteraction('grafana_instant_query_results_panel_toggle_clicked', {
          state: newMode,
        });
        onOptionsChange({ ...options, displayMode: newMode });
      },
      [options, onOptionsChange]
    );

    // Calculate table height based on data
    const getTableHeight = useCallback(() => {
      if (!processedData || processedData.length === 0) {
        return 200;
      }
      // Estimate table height based on row count
      return Math.max(Math.min(600, processedData[0].length * 35) + 35);
    }, [processedData]);

    const height = getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

    // Filter out empty frames
    const frames = processedData?.filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
    );

    const displayMode = options.displayMode ?? 'table';
    const title = displayMode === 'raw' ? 'Raw' : 'Table';

    // Render toggle if showToggle is true
    const renderLabel = () => {
      if (!options.showToggle) {
        return displayMode === 'raw' ? 'Raw' : 'Table';
      }

      return (
        <div className={styles.spacing}>
          <RadioButtonGroup
            onClick={() => {
              const nextMode = displayMode === 'table' ? 'raw' : 'table';
              reportInteraction('grafana_instant_query_results_panel_toggle_clicked', {
                state: nextMode,
              });
            }}
            size="sm"
            options={DISPLAY_MODE_OPTIONS}
            value={displayMode}
            onChange={onChangeDisplayMode}
          />
        </div>
      );
    };

    const renderTable = displayMode === 'table';

    return (
      <PanelChrome title={title} actions={renderLabel()} loadingState={data.state}>
        {frames?.length ? (
          <>
            {renderTable && (
              <Table
                ariaLabel={t('instant-query-results.table.aria-label', 'Instant query results')}
                data={frames[0]}
                width={tableWidth}
                height={height}
                onCellFilterAdded={panelContext.onAddAdHocFilter}
              />
            )}
            {displayMode === 'raw' && (
              <RawListContainer tableResult={frames[0]} defaultExpanded={options.expandedRawView} />
            )}
          </>
        ) : (
          <MetaInfoText metaItems={[{ value: '0 series returned' }]} />
        )}
      </PanelChrome>
    );
  }
);

InstantQueryResultsPanel.displayName = 'InstantQueryResultsPanel';
