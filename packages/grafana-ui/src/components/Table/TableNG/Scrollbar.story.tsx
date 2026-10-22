import { type Meta, type StoryFn } from '@storybook/react';
import { useMemo, useState } from 'react';

import { createDataFrame, FieldType, ReducerID } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { prepDataForStorybook } from '../../../utils/storybook/data';
import { Button } from '../../Button/Button';

import { TableNG } from './TableNG';

interface Args {
  width: number;
  height: number;
  rowCount: number;
  footer: boolean;
  wrapText: boolean;
  enablePagination: boolean;
  tableRefreshEnabled: boolean;
}

const meta: Meta<Args> = {
  title: 'Plugins/Table NG',
  args: {
    width: 800,
    height: 400,
    rowCount: 8,
    footer: true,
    wrapText: false,
    enablePagination: false,
    tableRefreshEnabled: false,
  },
};

export const ScrollbarBoundary: StoryFn<Args> = ({
  width,
  height,
  rowCount,
  footer,
  wrapText,
  enablePagination,
  tableRefreshEnabled,
}) => {
  const [moreRows, setMoreRows] = useState(false);
  const [compact, setCompact] = useState(false);
  const panelHeight = compact ? height / 2 : height;
  const count = moreRows ? rowCount * 10 : rowCount;
  const theme = useTheme2();
  const data = useMemo(
    () =>
      prepDataForStorybook(
        [
          createDataFrame({
            fields: [
              {
                name: 'Name',
                type: FieldType.string,
                values: Array.from({ length: count }, (_, i) => `Row ${i}: a value that can wrap onto another line`),
                config: { custom: { wrapText } },
              },
              {
                name: 'Value',
                type: FieldType.number,
                values: Array.from({ length: count }, (_, i) => i),
                config: { custom: { footer: { reducers: footer ? [ReducerID.sum] : [] } } },
              },
            ],
          }),
        ],
        theme
      )[0],
    [theme, count, footer, wrapText]
  );

  return (
    <>
      <Button onClick={() => setMoreRows(!moreRows)}>{moreRows ? 'Show fewer rows' : 'Show more rows'}</Button>
      <Button onClick={() => setCompact(!compact)}>{compact ? 'Restore panel height' : 'Shrink panel height'}</Button>
      <div style={{ width, height: panelHeight }}>
        <TableNG
          data={data}
          width={width}
          height={panelHeight}
          structureRev={1}
          enablePagination={enablePagination}
          tableRefreshEnabled={tableRefreshEnabled}
        />
      </div>
    </>
  );
};

export const NestedScrollbar: StoryFn<Args> = ({ width, height, tableRefreshEnabled }) => {
  const theme = useTheme2();
  const data = useMemo(() => {
    const nested = prepDataForStorybook(
      [
        createDataFrame({
          fields: [
            { name: 'Nested name', type: FieldType.string, values: ['First nested row', 'Last nested row'] },
            { name: 'Nested value', type: FieldType.number, values: [1, 2] },
          ],
        }),
      ],
      theme
    )[0];
    return prepDataForStorybook(
      [
        createDataFrame({
          fields: [
            { name: 'Name', type: FieldType.string, values: ['Parent row'] },
            { name: '__nestedFrames', type: FieldType.nestedFrames, values: [[nested]] },
          ],
        }),
      ],
      theme
    )[0];
  }, [theme]);
  return (
    <div style={{ width, height }}>
      <TableNG data={data} width={width} height={height} tableRefreshEnabled={tableRefreshEnabled} />
    </div>
  );
};

export default meta;
