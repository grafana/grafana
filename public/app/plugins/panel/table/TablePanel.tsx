import { css } from '@emotion/css';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Subscription, throttleTime } from 'rxjs';

import {
  DashboardCursorSync,
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  FieldMatcherID,
  FieldType,
  getFrameDisplayName,
  PanelProps,
  SelectableValue,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { Select, Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/src/components/Table/types';
import {
  calculateAroundPointThreshold,
  hasTimeField,
  isPointTimeValAroundTableTimeVal,
} from '@grafana/ui/src/components/Table/utils';

import { hasDeprecatedParentRowIndex, migrateFromParentRowIndexToNestedFrames } from './migrations';
import { Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id, timeRange } = props;
  const [rowHighlightIndex, setRowHighlightIndex] = React.useState<number | undefined>(undefined);

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const frames = hasDeprecatedParentRowIndex(data.series)
    ? migrateFromParentRowIndexToNestedFrames(data.series)
    : data.series;
  const count = frames?.length;
  const hasFields = frames[0]?.fields.length;
  const currentIndex = getCurrentFrameIndex(frames, options);
  const main = frames[currentIndex];

  let tableHeight = height;

  const threshold = useMemo(() => {
    const timeField = main.fields.find((f) => f.type === FieldType.time);

    if (!timeField) {
      return 0;
    }

    return calculateAroundPointThreshold(timeField);
  }, [main]);

  const onDataHoverEvent = useCallback(
    (evt: DataHoverEvent) => {
      if (evt.payload.point?.time && evt.payload.rowIndex !== undefined) {
        const timeField = main.fields.find((f) => f.type === FieldType.time);
        const time = timeField!.values[evt.payload.rowIndex];

        // If the time value of the hovered point is around the time value of the
        // row with same index, highlight the row
        if (isPointTimeValAroundTableTimeVal(evt.payload.point.time, time, threshold)) {
          setRowHighlightIndex(evt.payload.rowIndex);
          return;
        }

        // If the time value of the hovered point is not around the time value of the
        // row with same index, try to find a row with same time value
        const matchedRowIndex = timeField!.values.findIndex((t) =>
          isPointTimeValAroundTableTimeVal(evt.payload.point.time, t, threshold)
        );

        if (matchedRowIndex !== -1) {
          setRowHighlightIndex(matchedRowIndex);
          return;
        }

        setRowHighlightIndex(undefined);
      }
    },
    [main.fields, threshold]
  );

  useEffect(() => {
    if (!config.featureToggles.tableSharedCrosshair) {
      return;
    }

    if (
      !panelContext.sync ||
      panelContext.sync() === DashboardCursorSync.Off ||
      !hasTimeField(main) ||
      options.footer?.enablePagination
    ) {
      return;
    }

    const subs = new Subscription();

    subs.add(
      panelContext.eventBus
        .getStream(DataHoverEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => {
            if (panelContext.eventBus === evt.origin) {
              return;
            }

            onDataHoverEvent(evt);
          },
        })
    );

    subs.add(
      panelContext.eventBus
        .getStream(DataHoverClearEvent)
        .pipe(throttleTime(50))
        .subscribe({
          next: (evt) => {
            if (panelContext.eventBus === evt.origin) {
              return;
            }

            setRowHighlightIndex(undefined);
          },
        })
    );

    return () => {
      subs.unsubscribe();
    };
  }, [
    panelContext,
    frames,
    options.footer?.enablePagination,
    main,
    timeRange.to,
    timeRange.from,
    threshold,
    onDataHoverEvent,
  ]);

  const onRowHover = useCallback(
    (idx: number, frame: DataFrame) => {
      if (!panelContext.sync || panelContext.sync() === DashboardCursorSync.Off) {
        return;
      }

      if (!hasTimeField(frame)) {
        return;
      }

      const timeField: Field = frame!.fields.find((f) => f.type === FieldType.time)!;

      panelContext.eventBus.publish(
        new DataHoverEvent({
          point: {
            time: timeField.values[idx],
          },
        })
      );
    },
    [panelContext]
  );

  const onRowLeave = useCallback(() => {
    panelContext.eventBus.publish(new DataHoverClearEvent());
  }, [panelContext.eventBus]);

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
  }

  const tableElement = (
    <Table
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
      footerOptions={options.footer}
      enablePagination={options.footer?.enablePagination}
      cellHeight={options.cellHeight}
      timeRange={timeRange}
      onRowHover={config.featureToggles.tableSharedCrosshair ? onRowHover : undefined}
      onRowLeave={config.featureToggles.tableSharedCrosshair ? onRowLeave : undefined}
      rowHighlightIndex={rowHighlightIndex}
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

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px 8px 0px 8px;
  `,
};
