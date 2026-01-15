import { css } from '@emotion/css';
import { memo, useState } from 'react';

import { DataFrame, GrafanaTheme2, LoadingState, SelectableValue } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { RadioButtonGroup, Table, AdHocFilterItem, PanelChrome, useStyles2 } from '@grafana/ui';
import { PANEL_BORDER } from 'app/core/constants';
import { TABLE_RESULTS_STYLE, TABLE_RESULTS_STYLES, TableResultsStyle } from 'app/types/explore';

import { MetaInfoText } from '../MetaInfoText';
import RawListContainer from '../PrometheusListView/RawListContainer';

const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<TableResultsStyle>> = TABLE_RESULTS_STYLES.map((style) => ({
  value: style,
  // capital-case it and switch `_` to ` `
  label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));

const getStyles = (_theme: GrafanaTheme2) => ({
  spacing: css({
    display: 'flex',
    justifyContent: 'space-between',
    flex: '1',
  }),
});

/**
 * Props for the pure RawPrometheusContainer component.
 * This component expects pre-processed DataFrames (caller should apply applyFieldOverrides).
 */
export interface RawPrometheusContainerPureProps {
  /** Pre-processed DataFrames to display */
  tableResult: DataFrame[];
  /** Width of the container in pixels */
  width: number;
  /** Loading state for panel chrome indicator */
  loading?: LoadingState;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Start in Raw view instead of Table view. When true, shows toggle. When false/undefined, shows table only. */
  showRawPrometheus?: boolean;
  /** Callback when user adds a cell filter */
  onCellFilterAdded?: (filter: AdHocFilterItem) => void;
}

/**
 * Pure component for displaying Prometheus query results with Table/Raw toggle.
 * This component does NOT connect to Redux and expects pre-processed data.
 */
export const RawPrometheusContainerPure = memo(
  ({
    loading,
    onCellFilterAdded,
    tableResult,
    width,
    ariaLabel,
    showRawPrometheus,
  }: RawPrometheusContainerPureProps) => {
    const styles = useStyles2(getStyles);

    // If resultsStyle is undefined we won't render the toggle, and the default table will be rendered
    const [resultsStyle, setResultsStyle] = useState<TableResultsStyle | undefined>(
      showRawPrometheus ? TABLE_RESULTS_STYLE.raw : undefined
    );

    const onChangeResultsStyle = (newResultsStyle: TableResultsStyle) => {
      setResultsStyle(newResultsStyle);
    };

    const getTableHeight = () => {
      if (!tableResult || tableResult.length === 0) {
        return 200;
      }

      // tries to estimate table height
      return Math.max(Math.min(600, tableResult[0].length * 35) + 35);
    };

    const renderLabel = () => {
      return (
        <div className={styles.spacing}>
          <RadioButtonGroup
            onClick={() => {
              const props = {
                state: resultsStyle === TABLE_RESULTS_STYLE.table ? TABLE_RESULTS_STYLE.raw : TABLE_RESULTS_STYLE.table,
              };
              reportInteraction('grafana_explore_prometheus_instant_query_ui_toggle_clicked', props);
            }}
            size="sm"
            options={ALL_GRAPH_STYLE_OPTIONS}
            value={resultsStyle}
            onChange={onChangeResultsStyle}
          />
        </div>
      );
    };

    const height = getTableHeight();
    const tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;

    const frames = tableResult?.filter(
      (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
    );

    const title = resultsStyle === TABLE_RESULTS_STYLE.raw ? 'Raw' : 'Table';
    const label = resultsStyle !== undefined ? renderLabel() : 'Table';

    // Render table as default if resultsStyle is not set.
    const renderTable = !resultsStyle || resultsStyle === TABLE_RESULTS_STYLE.table;

    return (
      <PanelChrome title={title} actions={label} loadingState={loading}>
        {frames?.length && (
          <>
            {renderTable && (
              <Table
                ariaLabel={ariaLabel}
                data={frames[0]}
                width={tableWidth}
                height={height}
                onCellFilterAdded={onCellFilterAdded}
              />
            )}
            {resultsStyle === TABLE_RESULTS_STYLE.raw && (
              <RawListContainer tableResult={frames[0]} ariaLabel={ariaLabel} />
            )}
          </>
        )}
        {!frames?.length && <MetaInfoText metaItems={[{ value: '0 series returned' }]} />}
      </PanelChrome>
    );
  }
);

RawPrometheusContainerPure.displayName = 'RawPrometheusContainerPure';
