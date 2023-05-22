import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldMatcherID, getFrameDisplayName, PanelProps, SelectableValue } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Select, Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/src/components/Table/types';

import { PanelOptions } from './panelcfg.gen';

interface Props extends PanelProps<PanelOptions> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id } = props;

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const frames = data.series;
  const mainFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex === undefined);
  const subFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex !== undefined);
  const count = mainFrames?.length;
  const hasFields = mainFrames[0]?.fields.length;
  const currentIndex = getCurrentFrameIndex(mainFrames, options);
  const main = mainFrames[currentIndex];

  let tableHeight = height;
  let subData = subFrames;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
    subData = subFrames.filter((f) => f.refId === main.refId);
  }

  const tableElement = (
    <Table
      height={tableHeight}
      // This calculation is to accommodate the optionally rendered Row Numbers Column
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
      subData={subData}
      cellHeight={options.cellHeight}
    />
  );

  if (count === 1) {
    return tableElement;
  }

  const names = mainFrames.map((frame, index) => {
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

function getCurrentFrameIndex(frames: DataFrame[], options: PanelOptions) {
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
