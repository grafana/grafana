import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import {
  ActionModel,
  DashboardCursorSync,
  DataFrame,
  FieldMatcherID,
  getFrameDisplayName,
  InterpolateFunction,
  PanelProps,
  SelectableValue,
  Field,
  cacheFieldDisplayNames,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { Select, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/internal';
import { TableNG } from '@grafana/ui/unstable';
import { getConfig } from 'app/core/config';

import { getActions } from '../../../features/actions/utils';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
import { Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id, timeRange, replaceVariables, transparent } = props;

  useMemo(() => {
    cacheFieldDisplayNames(data.series);
  }, [data.series]);

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const _getActions = useCallback(
    (frame: DataFrame, field: Field, rowIndex: number) => getCellActions(frame, field, rowIndex, replaceVariables),
    [replaceVariables]
  );
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

  const enableSharedCrosshair = panelContext.sync && panelContext.sync() !== DashboardCursorSync.Off;

  const disableSanitizeHtml = getConfig().disableSanitizeHtml;

  const tableElement = (
    <TableNG
      height={tableHeight}
      width={width}
      data={main}
      noHeader={!options.showHeader}
      showTypeIcons={options.showTypeIcons}
      resizable={true}
      initialSortBy={options.sortBy}
      onSortByChange={(sortBy) => onSortByChange(sortBy, props)}
      onColumnResize={(displayName, resizedWidth) => onColumnResize(displayName, resizedWidth, props)}
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      frozenColumns={options.frozenColumns?.left}
      enablePagination={options.footer?.enablePagination}
      cellHeight={options.cellHeight}
      timeRange={timeRange}
      enableSharedCrosshair={config.featureToggles.tableSharedCrosshair && enableSharedCrosshair}
      fieldConfig={fieldConfig}
      getActions={_getActions}
      structureRev={data.structureRev}
      transparent={transparent}
      disableSanitizeHtml={disableSanitizeHtml}
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

function onColumnResize(fieldDisplayName: string, width: number, props: Props) {
  const { fieldConfig } = props;
  const { overrides } = fieldConfig;

  const matcherId = FieldMatcherID.byName;
  const propId = 'custom.width';

  // look for existing override
  const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);

  if (override) {
    // look for existing property
    const property = override.properties.find((prop) => prop.id === propId);
    if (property) {
      property.value = width;
    } else {
      override.properties.push({ id: propId, value: width });
    }
  } else {
    overrides.push({
      matcher: { id: matcherId, options: fieldDisplayName },
      properties: [{ id: propId, value: width }],
    });
  }

  props.onFieldConfigChange({
    ...fieldConfig,
    overrides,
  });
}

function onSortByChange(sortBy: TableSortByFieldState[], props: Props) {
  props.onOptionsChange({
    ...props.options,
    sortBy,
  });
}

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}

// placeholder function; assuming the values are already interpolated
const replaceVars: InterpolateFunction = (value: string) => value;

const getCellActions = (
  dataFrame: DataFrame,
  field: Field,
  rowIndex: number,
  replaceVariables: InterpolateFunction | undefined
): Array<ActionModel<Field>> => {
  const numActions = field.config.actions?.length ?? 0;

  if (numActions > 0) {
    const actions = getActions(
      dataFrame,
      field,
      field.state!.scopedVars!,
      replaceVariables ?? replaceVars,
      field.config.actions ?? [],
      { valueRowIndex: rowIndex }
    );

    if (actions.length === 1) {
      return actions;
    } else {
      const actionsOut: Array<ActionModel<Field>> = [];
      const actionLookup = new Set<string>();

      actions.forEach((action) => {
        const key = action.title;

        if (!actionLookup.has(key)) {
          actionsOut.push(action);
          actionLookup.add(key);
        }
      });

      return actionsOut;
    }
  }

  return [];
};

const tableStyles = {
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  }),
  selectWrapper: css({
    padding: '8px 8px 0px 8px',
  }),
};
