import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import {
  FieldConfigSource,
  GrafanaTheme2,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  PanelProps,
  store,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import type { Options as TableOptions } from '@grafana/schema/src/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';
import { useStyles2 } from '@grafana/ui';
import { getDefaultControlsExpandedMode } from 'app/features/logs/components/panel/LogListContext';
import { CONTROLS_WIDTH_EXPANDED } from 'app/features/logs/components/panel/LogListControls';
import { LogTableControls } from 'app/features/logs/components/panel/LogTableControls';
import { LOG_LIST_CONTROLS_WIDTH } from 'app/features/logs/components/panel/virtualization';

import { SETTING_KEY_ROOT } from '../../../features/explore/Logs/utils/logs';
import { TablePanel } from '../table/TablePanel';

import { Options } from './options/types';
import { defaultOptions } from './panelcfg.gen';

interface Props extends PanelProps<Options> {
  initialRowIndex?: number;
  logOptionsStorageKey: string;
  containerElement: HTMLDivElement;
  fieldSelectorWidth: number;
  sortOrder: LogsSortOrder;
}

export function TableNGWrap({
  timeZone,
  timeRange,
  id,
  data,
  options,
  onOptionsChange,
  height,
  width: tableWidth,
  transparent,
  fieldConfig,
  renderCounter,
  title,
  eventBus,
  onFieldConfigChange,
  replaceVariables,
  onChangeTimeRange,
  fieldSelectorWidth,
  initialRowIndex,
  logOptionsStorageKey,
  containerElement,
  sortOrder,
}: Props) {
  const showControls = options.showControls ?? defaultOptions.showControls ?? true;
  const controlsExpandedFromStore = store.getBool(
    `${logOptionsStorageKey}.controlsExpanded`,
    getDefaultControlsExpandedMode(containerElement ?? null)
  );

  const [controlsExpanded, setControlsExpanded] = useState(controlsExpandedFromStore);
  const controlsWidth = !showControls ? 0 : controlsExpanded ? CONTROLS_WIDTH_EXPANDED : LOG_LIST_CONTROLS_WIDTH;
  const styles = useStyles2(getStyles, fieldSelectorWidth, height, tableWidth, controlsWidth);

  // Callbacks
  const onTableOptionsChange = useCallback(
    (options: TableOptions) => {
      onOptionsChange(options);
    },
    [onOptionsChange]
  );

  const handleSortOrderChange = useCallback(
    (sortOrder: LogsSortOrder) => {
      onOptionsChange({ ...options, sortOrder });
      getAppEvents().publish(
        new LogSortOrderChangeEvent({
          order: sortOrder,
        })
      );
    },
    [onOptionsChange, options]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  return (
    <div className={styles.tableWrapper}>
      {showControls && (
        <div className={styles.listControlsWrapper}>
          <LogTableControls
            logOptionsStorageKey={SETTING_KEY_ROOT}
            controlsExpanded={controlsExpanded}
            setControlsExpanded={setControlsExpanded}
            sortOrder={sortOrder}
            setSortOrder={handleSortOrderChange}
            timestampResolution={'ms'}
          />
        </div>
      )}

      <TablePanel
        initialRowIndex={initialRowIndex}
        data={data}
        width={Math.max(tableWidth - fieldSelectorWidth - controlsWidth, 0)}
        height={height}
        id={id}
        timeRange={timeRange}
        timeZone={timeZone}
        options={options}
        transparent={transparent}
        fieldConfig={fieldConfig}
        renderCounter={renderCounter}
        title={title}
        eventBus={eventBus}
        onOptionsChange={onTableOptionsChange}
        onFieldConfigChange={handleTableOnFieldConfigChange}
        replaceVariables={replaceVariables}
        onChangeTimeRange={onChangeTimeRange}
      />
    </div>
  );
}

const getStyles = (
  theme: GrafanaTheme2,
  fieldSelectorWidth: number,
  height: number,
  tableWidth: number,
  controlsWidth: number
) => {
  const listControlsWrapperTableHeaderOffset = '-5px';
  return {
    listControlsWrapper: css({
      height: '100%',
      width: controlsWidth,
      label: 'listControlsWrapper',
      marginTop: `calc(${theme.spacing.gridSize * theme.components.panel.headerHeight}px + ${listControlsWrapperTableHeaderOffset})`,
      position: 'absolute',
      right: 0,
      top: 0,
    }),
    tableWrapper: css({
      position: 'relative',
      paddingLeft: fieldSelectorWidth,
      paddingRight: controlsWidth,
      height,
      width: tableWidth,
      // @todo better row selection UI
      '[aria-selected=true]': {
        backgroundColor: theme.colors.background.secondary,
        outline: `solid 1px ${theme.colors.warning.border}`,
      },
    }),
  };
};
