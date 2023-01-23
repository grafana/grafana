import { css } from '@emotion/css';
import React from 'react';

import {
  DataFrame,
  FieldMatcherID,
  getFrameDisplayName,
  PanelProps,
  SelectableValue,
  // ArrayVector,
  // FieldType,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Select, Table, usePanelContext, useTheme2 } from '@grafana/ui';
import { TableSortByFieldState } from '@grafana/ui/src/components/Table/types';

import { PanelOptions } from './models.gen';

interface Props extends PanelProps<PanelOptions> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id } = props;

  // JEV: error on load (sometimes) -> The pseudo class ":nth-child" is potentially unsafe when doing server-side rendering. Try changing it to ":nth-of-type".

  // JEV: is there a useTheme1() hook?
  const theme = useTheme2();
  const panelContext = usePanelContext();
  // JEV: optional chain here?
  const frames = data.series;
  console.log('frames', frames);
  // JEV: a single function can push both values to respective arrays
  const mainFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex === undefined);
  console.log(mainFrames, 'mainFrames');
  const subFrames = frames.filter((f) => f.meta?.custom?.parentRowIndex !== undefined);
  console.log(subFrames, 'subFrames');
  // JEV: optional chain here superfluous; mainFrames will never be `undefined`, since it's being built with filter()
  const count = mainFrames?.length;
  console.log(count, 'count');
  const hasFields = mainFrames[0]?.fields.length;
  const currentIndex = getCurrentFrameIndex(mainFrames, options);
  console.log(currentIndex, 'currentIndex');
  // JEV: add row# field here?
  const main = mainFrames[currentIndex];
  // main.fields.unshift(buildRowNumField(main.length));
  console.log(main, 'main');
  // console.log(buildRowNumField(main.length), 'newField');

  let tableHeight = height;
  let subData = subFrames;

  // useEffect(() => {
  //   main.fields = [buildRowNumField(main.length), ...main.fields];
  // }, [addRows])

  // JEV: no data error handler
  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
    subData = subFrames.filter((f) => f.refId === main.refId);
  }

  // JEV: is this a single table row?
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
      onColumnResize={(displayName, width) => onColumnResize(displayName, width, props)}
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      footerOptions={options.footer}
      enablePagination={options.footer?.enablePagination}
      subData={subData}
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

// JEV: are we using function declarations instead of arrow functions for hoisting? the `this` keyword bindind? both?
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

// function buildRowNumField(length: number) {
//   return { name: 'row', type: FieldType['number'], config: {}, values: buildRowNumValues(length) };
// }

// function buildRowNumValues(length: number) {
//   let arr = [];
//   for (let i = 1; i <= length; i++) {
//     arr.push(i);
//   }
//   return new ArrayVector(arr);
// }

const tableStyles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  // JEV: this isn't being used anywhere; in the case of no data, we render <PanelDataErrorView />
  noData: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px 8px 0px 8px;
  `,
};
