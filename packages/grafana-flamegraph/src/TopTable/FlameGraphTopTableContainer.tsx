import { css } from '@emotion/css';
import { memo, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  DataFrame,
  DataLinkClickEvent,
  Field,
  FieldType,
  GrafanaTheme2,
  MappingType,
} from '@grafana/data';
import {
  IconButton,
  Table,
  TableCellDisplayMode,
  TableCustomCellOptions,
  TableFieldOptions,
  TableSortByFieldState,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { diffColorBlindColors, diffDefaultColors } from '../FlameGraph/colors';
import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { TOP_TABLE_COLUMN_WIDTH } from '../constants';
import { ColorScheme, ColorSchemeDiff, TableData } from '../types';

type Props = {
  data: FlameGraphDataContainer;
  onSymbolClick: (symbol: string) => void;
  // This is used for highlighting the search button in case there is exact match.
  search?: string;
  // We use these to filter out rows in the table if users is doing text search.
  matchedLabels?: Set<string>;
  sandwichItem?: string;
  onSearch: (str: string) => void;
  onSandwich: (str?: string) => void;
  onTableSort?: (sort: string) => void;
  colorScheme: ColorScheme | ColorSchemeDiff;
};

const FlameGraphTopTableContainer = memo(
  ({
    data,
    onSymbolClick,
    search,
    matchedLabels,
    onSearch,
    sandwichItem,
    onSandwich,
    onTableSort,
    colorScheme,
  }: Props) => {
    const table = useMemo(() => {
      // Group the data by label, we show only one row per label and sum the values
      // TODO: should be by filename + funcName + linenumber?
      let filteredTable: { [key: string]: TableData } = Object.create(null);
      for (let i = 0; i < data.data.length; i++) {
        const value = data.getValue(i);
        const valueRight = data.getValueRight(i);
        const self = data.getSelf(i);
        const label = data.getLabel(i);

        // If user is doing text search we filter out labels in the same way we highlight them in flame graph.
        if (!matchedLabels || matchedLabels.has(label)) {
          filteredTable[label] = filteredTable[label] || {};
          filteredTable[label].self = filteredTable[label].self ? filteredTable[label].self + self : self;
          filteredTable[label].total = filteredTable[label].total ? filteredTable[label].total + value : value;
          filteredTable[label].totalRight = filteredTable[label].totalRight
            ? filteredTable[label].totalRight + valueRight
            : valueRight;
        }
      }
      return filteredTable;
    }, [data, matchedLabels]);

    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const [sort, setSort] = useState<TableSortByFieldState[]>([{ displayName: 'Self', desc: true }]);

    return (
      <div className={styles.topTableContainer} data-testid="topTable">
        <AutoSizer style={{ width: '100%' }}>
          {({ width, height }) => {
            if (width < 3 || height < 3) {
              return null;
            }

            const frame = buildTableDataFrame(
              data,
              table,
              width,
              onSymbolClick,
              onSearch,
              onSandwich,
              theme,
              colorScheme,
              search,
              sandwichItem
            );
            return (
              <Table
                initialSortBy={sort}
                onSortByChange={(s) => {
                  if (s && s.length) {
                    onTableSort?.(s[0].displayName + '_' + (s[0].desc ? 'desc' : 'asc'));
                  }
                  setSort(s);
                }}
                data={frame}
                width={width}
                height={height}
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }
);

FlameGraphTopTableContainer.displayName = 'FlameGraphTopTableContainer';

function buildTableDataFrame(
  data: FlameGraphDataContainer,
  table: { [key: string]: TableData },
  width: number,
  onSymbolClick: (str: string) => void,
  onSearch: (str: string) => void,
  onSandwich: (str?: string) => void,
  theme: GrafanaTheme2,
  colorScheme: ColorScheme | ColorSchemeDiff,
  search?: string,
  sandwichItem?: string
): DataFrame {
  const actionField: Field = createActionField(onSandwich, onSearch, search, sandwichItem);

  const symbolField: Field = {
    type: FieldType.string,
    name: 'Symbol',
    values: [],
    config: {
      custom: { width: width - actionColumnWidth - TOP_TABLE_COLUMN_WIDTH * 2 },
      links: [
        {
          title: 'Highlight symbol',
          url: '',
          onClick: (e: DataLinkClickEvent) => {
            const field: Field = e.origin.field;
            const value = field.values[e.origin.rowIndex];
            onSymbolClick(value);
          },
        },
      ],
    },
  };

  let frame;

  if (data.isDiffFlamegraph()) {
    symbolField.config.custom.width = width - actionColumnWidth - TOP_TABLE_COLUMN_WIDTH * 3;

    const baselineField = createNumberField('Baseline', 'percent');
    const comparisonField = createNumberField('Comparison', 'percent');
    const diffField = createNumberField('Diff', 'percent');
    diffField.config.custom.cellOptions.type = TableCellDisplayMode.ColorText;

    const [removeColor, addColor] =
      colorScheme === ColorSchemeDiff.DiffColorBlind
        ? [diffColorBlindColors[0], diffColorBlindColors[2]]
        : [diffDefaultColors[0], diffDefaultColors[2]];

    diffField.config.mappings = [
      { type: MappingType.ValueToText, options: { [Infinity]: { text: 'new', color: addColor } } },
      { type: MappingType.ValueToText, options: { [-100]: { text: 'removed', color: removeColor } } },
      { type: MappingType.RangeToText, options: { from: 0, to: Infinity, result: { color: addColor } } },
      { type: MappingType.RangeToText, options: { from: -Infinity, to: 0, result: { color: removeColor } } },
    ];

    // For this we don't really consider sandwich view even though you can switch it on.
    const levels = data.getLevels();
    const totalTicks = levels.length ? levels[0][0].value : 0;
    const totalTicksRight = levels.length ? levels[0][0].valueRight : undefined;

    for (let key in table) {
      actionField.values.push(null);
      symbolField.values.push(key);

      const ticksLeft = table[key].total;
      const ticksRight = table[key].totalRight;

      // We are iterating over table of the data so totalTicksRight needs to be defined
      const totalTicksLeft = totalTicks - totalTicksRight!;

      const percentageLeft = Math.round((10000 * ticksLeft) / totalTicksLeft) / 100;
      const percentageRight = Math.round((10000 * ticksRight) / totalTicksRight!) / 100;

      const diff = ((percentageRight - percentageLeft) / percentageLeft) * 100;

      diffField.values.push(diff);
      baselineField.values.push(percentageLeft);
      comparisonField.values.push(percentageRight);
    }

    frame = {
      fields: [actionField, symbolField, baselineField, comparisonField, diffField],
      length: symbolField.values.length,
    };
  } else {
    const selfField = createNumberField('Self', data.selfField.config.unit);
    const totalField = createNumberField('Total', data.valueField.config.unit);

    for (let key in table) {
      actionField.values.push(null);
      symbolField.values.push(key);
      selfField.values.push(table[key].self);
      totalField.values.push(table[key].total);
    }

    frame = { fields: [actionField, symbolField, selfField, totalField], length: symbolField.values.length };
  }

  const dataFrames = applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value: string) => value,
    theme,
  });

  return dataFrames[0];
}

function createNumberField(name: string, unit?: string): Field {
  const tableFieldOptions: TableFieldOptions = {
    width: TOP_TABLE_COLUMN_WIDTH,
    align: 'auto',
    inspect: false,
    cellOptions: { type: TableCellDisplayMode.Auto },
  };

  return {
    type: FieldType.number,
    name,
    values: [],
    config: {
      unit,
      custom: tableFieldOptions,
    },
  };
}

const actionColumnWidth = 61;

function createActionField(
  onSandwich: (str?: string) => void,
  onSearch: (str: string) => void,
  search?: string,
  sandwichItem?: string
): Field {
  const options: TableCustomCellOptions = {
    type: TableCellDisplayMode.Custom,
    cellComponent: (props) => {
      return (
        <ActionCell
          frame={props.frame}
          onSandwich={onSandwich}
          onSearch={onSearch}
          search={search}
          sandwichItem={sandwichItem}
          rowIndex={props.rowIndex}
        />
      );
    },
  };

  const actionFieldTableConfig: TableFieldOptions = {
    filterable: false,
    width: actionColumnWidth,
    hideHeader: true,
    inspect: false,
    align: 'auto',
    cellOptions: options,
  };

  return {
    type: FieldType.number,
    name: 'actions',
    values: [],
    config: {
      custom: actionFieldTableConfig,
    },
  };
}

type ActionCellProps = {
  frame: DataFrame;
  rowIndex: number;
  search?: string;
  sandwichItem?: string;
  onSearch: (symbol: string) => void;
  onSandwich: (symbol: string) => void;
};

function ActionCell(props: ActionCellProps) {
  const styles = getStylesActionCell();
  const symbol = props.frame.fields.find((f: Field) => f.name === 'Symbol')?.values[props.rowIndex];
  const isSearched = props.search === symbol;
  const isSandwiched = props.sandwichItem === symbol;

  return (
    <div className={styles.actionCellWrapper}>
      <IconButton
        className={styles.actionCellButton}
        name={'search'}
        variant={isSearched ? 'primary' : 'secondary'}
        tooltip={isSearched ? 'Clear from search' : 'Search for symbol'}
        aria-label={isSearched ? 'Clear from search' : 'Search for symbol'}
        onClick={() => {
          props.onSearch(isSearched ? '' : symbol);
        }}
      />
      <IconButton
        className={styles.actionCellButton}
        name={'gf-show-context'}
        tooltip={isSandwiched ? 'Remove from sandwich view' : 'Show in sandwich view'}
        variant={isSandwiched ? 'primary' : 'secondary'}
        aria-label={isSandwiched ? 'Remove from sandwich view' : 'Show in sandwich view'}
        onClick={() => {
          props.onSandwich(isSandwiched ? undefined : symbol);
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    topTableContainer: css({
      label: 'topTableContainer',
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      height: '100%',
    }),
  };
};

const getStylesActionCell = () => {
  return {
    actionCellWrapper: css({
      label: 'actionCellWrapper',
      display: 'flex',
      height: '24px',
    }),
    actionCellButton: css({
      label: 'actionCellButton',
      marginRight: 0,
      width: '24px',
    }),
  };
};

export default FlameGraphTopTableContainer;
