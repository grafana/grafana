import { css } from '@emotion/css';
import { useCallback } from 'react';

import { FieldConfigSource, GrafanaTheme2, PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TablePanel } from '../table/TablePanel';
import type { Options as TableOptions } from '../table/panelcfg.gen';

import { DEFAULT_SIDEBAR_WIDTH } from './constants';

interface Props extends PanelProps<TableOptions> {}

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
}: Props) {
  const styles = useStyles2(getStyles, DEFAULT_SIDEBAR_WIDTH, height, width);

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
        data={data}
        width={width - DEFAULT_SIDEBAR_WIDTH}
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
    }),
  };
};
