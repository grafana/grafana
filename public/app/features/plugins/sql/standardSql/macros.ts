import { MacrosRegistryItem } from './types';

const COLUMN = 'column',
  RELATIVE_TIME_STRING = "'5m'";

export enum MacroType {
  Value,
  Filter,
  Group,
  Column,
  Table,
}

export const MACROS: MacrosRegistryItem[] = [
  {
    id: '$__timeFilter(dateColumn)',
    name: '$__timeFilter(dateColumn)',
    text: '$__timeFilter',
    args: [COLUMN],
    type: MacroType.Filter,
    description:
      'Will be replaced by a time range filter using the specified column name. For example, dateColumn BETWEEN FROM_UNIXTIME(1494410783) AND FROM_UNIXTIME(1494410983)',
  },
  {
    id: '$__timeFrom()',
    name: '$__timeFrom()',
    text: '$__timeFrom',
    args: [],
    type: MacroType.Filter,
    description:
      'Will be replaced by the start of the currently active time selection. For example, FROM_UNIXTIME(1494410783)',
  },
  {
    id: '$__timeTo()',
    name: '$__timeTo()',
    text: '$__timeTo',
    args: [],
    type: MacroType.Filter,
    description:
      'Will be replaced by the end of the currently active time selection. For example, FROM_UNIXTIME(1494410983)',
  },
  {
    id: "$__timeGroup(dateColumn, '5m')",
    name: "$__timeGroup(dateColumn, '5m')",
    text: '$__timeGroup',
    args: [COLUMN, RELATIVE_TIME_STRING],
    type: MacroType.Value,
    description:
      'Will be replaced by an expression usable in GROUP BY clause. For example, *cast(cast(UNIX_TIMESTAMP(dateColumn)/(300) as signed)*300 as signed),*',
  },
  {
    id: '$__table',
    name: '$__table',
    text: '$__table',
    args: [],
    type: MacroType.Table,
    description: 'Will be replaced by the query table.',
  },
  {
    id: '$__column',
    name: '$__column',
    text: '$__column',
    args: [],
    type: MacroType.Column,
    description: 'Will be replaced by the query column.',
  },
];
