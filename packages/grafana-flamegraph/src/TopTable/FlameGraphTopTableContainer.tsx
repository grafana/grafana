import { css } from '@emotion/css';
import { memo, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  applyFieldOverrides,
  type DataFrame,
  type DataLinkClickEvent,
  type Field,
  FieldType,
  formattedValueToString,
  getValueFormat,
  type GrafanaTheme2,
  MappingType,
  escapeStringForRegex,
} from '@grafana/data';
import {
  IconButton,
  Table,
  TableCellDisplayMode,
  type TableCustomCellOptions,
  type TableFieldOptions,
  type TableSortByFieldState,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { diffColorBlindColors, diffDefaultColors } from '../FlameGraph/colors';
import { type FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { TOP_TABLE_COLUMN_WIDTH } from '../constants';
import { type ColorScheme, ColorSchemeDiff, type TableData } from '../types';

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
    const table = useMemo(() => buildFilteredTable(data, matchedLabels), [data, matchedLabels]);

    // Separate the "other" entry from the main table
    const { tableWithoutOther, otherEntry } = useMemo(() => {
      const otherData = table['other'];
      if (!otherData) {
        return { tableWithoutOther: table, otherEntry: undefined };
      }
      const { ['other']: _, ...rest } = table;
      return { tableWithoutOther: rest, otherEntry: otherData };
    }, [table]);

    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const [sort, setSort] = useState<TableSortByFieldState[]>([{ displayName: 'Self', desc: true }]);

    const otherSectionHeight = otherEntry ? 32 : 0;

    return (
      <div className={styles.topTableContainer} data-testid="topTable">
        <AutoSizer style={{ width: '100%' }}>
          {({ width, height }) => {
            if (width < 3 || height < 3) {
              return null;
            }

            const tableHeight = height - otherSectionHeight;

            const frame = buildTableDataFrame(
              data,
              tableWithoutOther,
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
              <>
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
                  height={tableHeight}
                />
                {otherEntry && (
                  <OtherRow
                    otherEntry={otherEntry}
                    data={data}
                    onSearch={onSearch}
                    onSandwich={onSandwich}
                    onSymbolClick={onSymbolClick}
                    search={search}
                    sandwichItem={sandwichItem}
                  />
                )}
              </>
            );
          }}
        </AutoSizer>
      </div>
    );
  }
);

FlameGraphTopTableContainer.displayName = 'FlameGraphTopTableContainer';

function buildFilteredTable(data: FlameGraphDataContainer, matchedLabels?: Set<string>) {
  // Group the data by label, we show only one row per label and sum the values
  // TODO: should be by filename + funcName + linenumber?
  let filteredTable: { [key: string]: TableData } = Object.create(null);

  // Track call stack to detect recursive calls
  const callStack: string[] = [];

  for (let i = 0; i < data.data.length; i++) {
    const value = data.getValue(i);
    const valueRight = data.getValueRight(i);
    const self = data.getSelf(i);
    const label = data.getLabel(i);
    const level = data.getLevel(i);

    // Maintain call stack based on level changes
    while (callStack.length > level) {
      callStack.pop();
    }

    // Check if this is a recursive call (same label already in call stack)
    const isRecursive = callStack.some((entry) => entry === label);

    // If user is doing text search we filter out labels in the same way we highlight them in flame graph.
    if (!matchedLabels || matchedLabels.has(label)) {
      filteredTable[label] = filteredTable[label] || {};
      filteredTable[label].self = filteredTable[label].self ? filteredTable[label].self + self : self;

      // Only add to total if this is not a recursive call
      if (!isRecursive) {
        filteredTable[label].total = filteredTable[label].total ? filteredTable[label].total + value : value;
        filteredTable[label].totalRight = filteredTable[label].totalRight
          ? filteredTable[label].totalRight + valueRight
          : valueRight;
      }
    }

    // Add current call to the stack
    callStack.push(label);
  }

  return filteredTable;
}

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
  const isSearched = props.search === `^${escapeStringForRegex(String(symbol))}$`;
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

type OtherRowProps = {
  otherEntry: TableData;
  data: FlameGraphDataContainer;
  onSearch: (str: string) => void;
  onSandwich: (str?: string) => void;
  onSymbolClick: (str: string) => void;
  search?: string;
  sandwichItem?: string;
};

function OtherRow({ otherEntry, data, onSearch, onSandwich, onSymbolClick, search, sandwichItem }: OtherRowProps) {
  const styles = useStyles2(getOtherRowStyles);
  const unit = data.selfField.config.unit;
  const formatter = getValueFormat(unit || 'short');
  const formattedSelf = formattedValueToString(formatter(otherEntry.self));

  const isSearched = search === `^${escapeStringForRegex('other')}$`;
  const isSandwiched = sandwichItem === 'other';

  return (
    <div className={styles.otherRow} data-testid="otherRow">
      <div className={styles.otherRowActions}>
        <IconButton
          name={'search'}
          size="sm"
          variant={isSearched ? 'primary' : 'secondary'}
          tooltip={isSearched ? 'Clear from search' : 'Search for symbol'}
          aria-label={isSearched ? 'Clear from search' : 'Search for symbol'}
          onClick={() => onSearch(isSearched ? '' : 'other')}
        />
        <IconButton
          name={'gf-show-context'}
          size="sm"
          tooltip={isSandwiched ? 'Remove from sandwich view' : 'Show in sandwich view'}
          variant={isSandwiched ? 'primary' : 'secondary'}
          aria-label={isSandwiched ? 'Remove from sandwich view' : 'Show in sandwich view'}
          onClick={() => onSandwich(isSandwiched ? undefined : 'other')}
        />
      </div>
      <span className={styles.otherRowText}>
        A total of <button className={styles.otherRowLink} onClick={() => onSymbolClick('other')}>{formattedSelf}</button> has been truncated and is represented by &quot;other&quot; in the flamegraph.
      </span>
    </div>
  );
}

const getOtherRowStyles = (theme: GrafanaTheme2) => {
  return {
    otherRow: css({
      label: 'otherRow',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    otherRowActions: css({
      label: 'otherRowActions',
      display: 'flex',
      gap: theme.spacing(0.25),
      flexShrink: 0,
    }),
    otherRowText: css({
      label: 'otherRowText',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    otherRowLink: css({
      label: 'otherRowLink',
      background: 'none',
      border: 'none',
      padding: 0,
      color: theme.colors.text.link,
      cursor: 'pointer',
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: 'inherit',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};

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

export { buildFilteredTable };

export default FlameGraphTopTableContainer;
