import { css } from '@emotion/css';

import {
  DashboardCursorSync,
  DataFrame,
  FieldMatcherID,
  getFrameDisplayName,
  PanelProps,
  SelectableValue,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { Select, Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/src/components/Table/types';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
import { Options } from './panelcfg.gen';

import 'react-data-grid/lib/styles.css';

import DataGrid from 'react-data-grid';

interface Props extends PanelProps<Options> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id, timeRange } = props;

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const frames = hasDeprecatedParentRowIndex(data.series)
    ? migrateFromParentRowIndexToNestedFrames(data.series)
    : data.series;
  const count = frames?.length;
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const currentIndex = getCurrentFrameIndex(frames, options);
  const main = frames[currentIndex];

  let tableHeight = height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
  }

  // const enableSharedCrosshair = panelContext.sync && panelContext.sync() !== DashboardCursorSync.Off;

  const columns: Array<{ key: string; name: string }> = [];
  const rows: Array<{ [key: string]: string }> = [];

  main.fields.map((field) => {
    const key = field.name;
    columns.push({ key, name: key }); // TODO add display function output
    field.values.map((value, index) => {
      const currentValue = { [key]: String(value) };
      if (rows.length > index) {
        rows[index] = { ...rows[index], ...currentValue };
      } else {
        rows[index] = currentValue;
      }
    });
  });

  const tableElement = (
    <DataGrid
      columns={columns}
      rows={rows}
      className={tableStyles.dataGrid}
      defaultColumnOptions={{
        sortable: true,
        resizable: true,
        maxWidth: 200, // TODO base on panel options
      }}
    />
  );

  if (count === 1) {
    return tableElement;
  }

  const names = frames.map((frame, index) => {
    return {
      label: getFrameDisplayName(frame),
      value: index,
    };
  });

  return (
    <div className={tableStyles.wrapper}>
      {tableElement}
      <div className={tableStyles.selectWrapper}>
        <Select options={names} value={names[currentIndex]} onChange={(val) => onChangeTableSelection(val, props)} />
      </div>
    </div>
  );
}

function getCurrentFrameIndex(frames: DataFrame[], options: Options) {
  return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}

// function onColumnResize(fieldDisplayName: string, width: number, props: Props) {
//   const { fieldConfig } = props;
//   const { overrides } = fieldConfig;

//   const matcherId = FieldMatcherID.byName;
//   const propId = 'custom.width';

//   // look for existing override
//   const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);

//   if (override) {
//     // look for existing property
//     const property = override.properties.find((prop) => prop.id === propId);
//     if (property) {
//       property.value = width;
//     } else {
//       override.properties.push({ id: propId, value: width });
//     }
//   } else {
//     overrides.push({
//       matcher: { id: matcherId, options: fieldDisplayName },
//       properties: [{ id: propId, value: width }],
//     });
//   }

//   props.onFieldConfigChange({
//     ...fieldConfig,
//     overrides,
//   });
// }

// function onSortByChange(sortBy: TableSortByFieldState[], props: Props) {
//   props.onOptionsChange({
//     ...props.options,
//     sortBy,
//   });
// }

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  dataGrid: css`
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px 8px 0px 8px;
  `,
};
