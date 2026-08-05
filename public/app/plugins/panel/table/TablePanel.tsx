import { useEffect, useState } from 'react';

import {
  applyFieldOverrides,
  DataTransformerID,
  type DataFrame,
  type DataTransformerConfig,
  FieldMatcherID,
  getFrameDisplayName,
  type PanelProps,
  type SelectableValue,
  transformDataFrame,
} from '@grafana/data';
import { GroupByOperationID, type GroupToNestedTableTransformerOptionsV2 } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { PanelDataErrorView } from '@grafana/runtime';
import { type TableOptions } from '@grafana/schema';
import { Combobox, Field, Stack, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableNG } from '@grafana/ui/unstable';
import {
  useCacheFieldDisplayNames,
  useCellActions,
  useCommonTableProps,
  useTableSharedCrosshair,
} from 'app/features/table/hooks';
import { getCurrentFrameIndex, onColumnResize, onSortByChange } from 'app/features/table/utils';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';

interface Props extends PanelProps<TableOptions> {
  initialRowIndex?: number;
  sortByBehavior?: 'initial' | 'managed';
}

interface EphemeralGroupedFrame {
  fieldName: string;
  source: DataFrame;
  frame: DataFrame;
}

export function createEphemeralGroupTransformation(
  fieldName: string
): DataTransformerConfig<GroupToNestedTableTransformerOptionsV2> {
  return {
    id: DataTransformerID.groupToNestedTable,
    options: {
      rules: [
        {
          matcher: { id: FieldMatcherID.byName, options: fieldName },
          operation: GroupByOperationID.groupBy,
          aggregations: [],
        },
      ],
    },
  };
}

export function TablePanel(props: Props) {
  const {
    data,
    height,
    width,
    options,
    fieldConfig,
    id,
    timeRange,
    replaceVariables,
    transparent,
    initialRowIndex,
    sortByBehavior = 'initial',
  } = props;

  useCacheFieldDisplayNames(data.series);

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const getActions = useCellActions(replaceVariables);
  const commonTableProps = useCommonTableProps(options, fieldConfig);
  const enableSharedCrosshair = useTableSharedCrosshair();
  const frames = hasDeprecatedParentRowIndex(data.series)
    ? migrateFromParentRowIndexToNestedFrames(data.series)
    : data.series;
  const count = frames?.length;
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const currentIndex = getCurrentFrameIndex(frames, options);
  const main = frames[currentIndex];
  const [groupBy, setGroupBy] = useState<{ fieldName: string; frameIndex: number }>();
  const [groupedFrame, setGroupedFrame] = useState<EphemeralGroupedFrame>();
  const activeGroupBy = groupBy?.frameIndex === currentIndex ? groupBy.fieldName : undefined;

  useEffect(() => {
    if (!main || !activeGroupBy) {
      setGroupedFrame(undefined);
      return;
    }

    const transformation = createEphemeralGroupTransformation(activeGroupBy);
    const subscription = transformDataFrame([transformation], [main]).subscribe((result) => {
      const processedResult = applyFieldOverrides({
        data: result,
        fieldConfig,
        replaceVariables,
        theme,
      });
      setGroupedFrame({
        fieldName: activeGroupBy,
        source: main,
        frame: processedResult[0] ?? main,
      });
    });
    return () => subscription.unsubscribe();
  }, [activeGroupBy, fieldConfig, main, replaceVariables, theme]);

  const hasCurrentGroupedFrame =
    groupedFrame != null && groupedFrame.fieldName === activeGroupBy && groupedFrame.source === main;
  const displayedFrame = hasCurrentGroupedFrame ? groupedFrame.frame : main;

  let tableHeight = height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
  }

  const tableElement = (
    <TableNG
      {...commonTableProps}
      initialRowIndex={initialRowIndex}
      height={tableHeight}
      width={width}
      data={displayedFrame}
      sortByBehavior={sortByBehavior}
      onSortByChange={(sortBy) => onSortByChange(sortBy, props)}
      onColumnResize={(displayName, resizedWidth, fieldScope) =>
        onColumnResize(displayName, resizedWidth, fieldScope, props)
      }
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      timeRange={timeRange}
      enableSharedCrosshair={enableSharedCrosshair}
      fieldConfig={fieldConfig}
      getActions={getActions}
      onGroupByColumn={(fieldName) => setGroupBy({ fieldName, frameIndex: currentIndex })}
      groupedFieldName={activeGroupBy}
      onUngroup={activeGroupBy ? () => setGroupBy(undefined) : undefined}
      structureRev={data.structureRev}
      transparent={transparent}
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
    <Stack direction="column" gap={1.5} justifyContent="space-between" height="100%">
      {tableElement}
      <Field noMargin>
        <Combobox
          aria-label={t('table.frame-picker.label', 'Query')}
          options={names}
          value={names[currentIndex]}
          onChange={(val) => onChangeTableSelection(val, props)}
        />
      </Field>
    </Stack>
  );
}

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}
