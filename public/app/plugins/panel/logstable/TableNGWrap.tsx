import { css } from '@emotion/css';
import { useCallback } from 'react';

import { FieldConfigSource, GrafanaTheme2, PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import { DEFAULT_SIDEBAR_WIDTH } from './constants';

interface Props extends PanelProps<TableOptions> {
  fieldSelectorWidth: number | undefined;
  initialRowIndex?: number;
}

export function TableNGWrap({
  timeZone,
  timeRange,
  id,
  data,
  options,
  onOptionsChange,
  height,
  width,
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
}: Props) {
  const sidebarWidth = fieldSelectorWidth ?? DEFAULT_SIDEBAR_WIDTH;
  const styles = useStyles2(getStyles, sidebarWidth, height, width);

  // Callbacks
  const onTableOptionsChange = useCallback(
    (options: TableOptions) => {
      onOptionsChange?.(options);
    },
    [onOptionsChange]
  );

  const handleTableOnFieldConfigChange = useCallback(
    (fieldConfig: FieldConfigSource) => {
      onFieldConfigChange(fieldConfig);
    },
    [onFieldConfigChange]
  );

  console.log('render::TableNGWrap');

  return (
    <div className={styles.tableWrapper}>
      <TablePanel
        initialRowIndex={initialRowIndex}
        data={data}
        width={width - sidebarWidth}
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

const getStyles = (theme: GrafanaTheme2, sidebarWidth: number, height: number, width: number) => {
  return {
    tableWrapper: css({
      paddingLeft: sidebarWidth,
      height,
      width,
      // @todo better row selection UI
      '[aria-selected=true]': {
        backgroundColor: theme.colors.background.secondary,
        outline: `solid 1px ${theme.colors.warning.border}`,
      },
    }),
  };
};
