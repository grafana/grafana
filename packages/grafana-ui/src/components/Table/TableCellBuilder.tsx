// Libraries
import _ from 'lodash';
import React, { ReactElement } from 'react';
import { GridCellProps } from 'react-virtualized';
import { Table, Props } from './Table';
import moment from 'moment';
import { ValueFormatter } from '../../utils/index';
import { GrafanaTheme } from '../../types/theme';
import { getValueFormat, getColorFromHexRgbOrName, Field } from '@grafana/ui';
import { InterpolateFunction } from '../../types/panel';

export interface TableCellBuilderOptions {
  value: any;
  column?: Field;
  row?: any[];
  table?: Table;
  className?: string;
  props: GridCellProps;
}

export type TableCellBuilder = (cell: TableCellBuilderOptions) => ReactElement<'div'>;

/** Simplest cell that just spits out the value */
export const simpleCellBuilder: TableCellBuilder = (cell: TableCellBuilderOptions) => {
  const { props, value, className } = cell;
  const { style } = props;

  return (
    <div style={style} className={'gf-table-cell ' + className}>
      {value}
    </div>
  );
};

// ***************************************************************************
// HERE BE DRAGONS!!!
// ***************************************************************************
//
//  The following code has been migrated blindy two times from the angular
//  table panel.  I don't understand all the options nor do I know if they
//  are correct!
//
// ***************************************************************************

// Made to match the existing (untyped) settings in the angular table
export interface ColumnStyle {
  pattern: string;

  alias?: string;
  colorMode?: 'cell' | 'value';
  colors?: any[];
  decimals?: number;
  thresholds?: any[];
  type?: 'date' | 'number' | 'string' | 'hidden';
  unit?: string;
  dateFormat?: string;
  sanitize?: boolean; // not used in react
  mappingType?: any;
  valueMaps?: any;
  rangeMaps?: any;

  link?: any;
  linkUrl?: any;
  linkTooltip?: any;
  linkTargetBlank?: boolean;

  preserveFormat?: boolean;
}

// private mapper:ValueMapper,
// private style:ColumnStyle,
// private theme:GrafanaTheme,
// private column:Column,
// private replaceVariables: InterpolateFunction,
// private fmt?:ValueFormatter) {

export function getCellBuilder(schema: Field, style: ColumnStyle | null, props: Props): TableCellBuilder {
  if (!style) {
    return simpleCellBuilder;
  }

  if (style.type === 'hidden') {
    // TODO -- for hidden, we either need to:
    // 1. process the Table and remove hidden fields
    // 2. do special math to pick the right column skipping hidden fields
    throw new Error('hidden not supported!');
  }

  if (style.type === 'date') {
    return new CellBuilderWithStyle(
      (v: any) => {
        if (v === undefined || v === null) {
          return '-';
        }

        if (_.isArray(v)) {
          v = v[0];
        }
        let date = moment(v);
        if (false) {
          // TODO?????? this.props.isUTC) {
          date = date.utc();
        }
        return date.format(style.dateFormat);
      },
      style,
      props.theme,
      schema,
      props.replaceVariables
    ).build;
  }

  if (style.type === 'string') {
    return new CellBuilderWithStyle(
      (v: any) => {
        if (_.isArray(v)) {
          v = v.join(', ');
        }
        return v;
      },
      style,
      props.theme,
      schema,
      props.replaceVariables
    ).build;
    // TODO!!!!  all the mapping stuff!!!!
  }

  if (style.type === 'number') {
    const valueFormatter = getValueFormat(style.unit || schema.unit || 'none');
    return new CellBuilderWithStyle(
      (v: any) => {
        if (v === null || v === void 0) {
          return '-';
        }
        return v;
      },
      style,
      props.theme,
      schema,
      props.replaceVariables,
      valueFormatter
    ).build;
  }

  return simpleCellBuilder;
}

type ValueMapper = (value: any) => any;

// Runs the value through a formatter and adds colors to the cell properties
class CellBuilderWithStyle {
  constructor(
    private mapper: ValueMapper,
    private style: ColumnStyle,
    private theme: GrafanaTheme,
    private column: Field,
    private replaceVariables: InterpolateFunction,
    private fmt?: ValueFormatter
  ) {
    //
    console.log('COLUMN', column.name, theme);
  }

  getColorForValue = (value: any): string | null => {
    const { thresholds, colors } = this.style;
    if (!thresholds || !colors) {
      return null;
    }

    for (let i = thresholds.length; i > 0; i--) {
      if (value >= thresholds[i - 1]) {
        return getColorFromHexRgbOrName(colors[i], this.theme.type);
      }
    }
    return getColorFromHexRgbOrName(_.first(colors), this.theme.type);
  };

  build = (cell: TableCellBuilderOptions) => {
    let { props } = cell;
    let value = this.mapper(cell.value);

    if (_.isNumber(value)) {
      if (this.fmt) {
        value = this.fmt(value, this.style.decimals);
      }

      // For numeric values set the color
      const { colorMode } = this.style;
      if (colorMode) {
        const color = this.getColorForValue(Number(value));
        if (color) {
          if (colorMode === 'cell') {
            props = {
              ...props,
              style: {
                ...props.style,
                backgroundColor: color,
                color: 'white',
              },
            };
          } else if (colorMode === 'value') {
            props = {
              ...props,
              style: {
                ...props.style,
                color: color,
              },
            };
          }
        }
      }
    }

    const cellClasses = [];
    if (this.style.preserveFormat) {
      cellClasses.push('table-panel-cell-pre');
    }

    if (this.style.link) {
      // Render cell as link
      const { row } = cell;

      const scopedVars: any = {};
      if (row) {
        for (let i = 0; i < row.length; i++) {
          scopedVars[`__cell_${i}`] = { value: row[i] };
        }
      }
      scopedVars['__cell'] = { value: value };

      const cellLink = this.replaceVariables(this.style.linkUrl, scopedVars, encodeURIComponent);
      const cellLinkTooltip = this.replaceVariables(this.style.linkTooltip, scopedVars);
      const cellTarget = this.style.linkTargetBlank ? '_blank' : '';

      cellClasses.push('table-panel-cell-link');
      value = (
        <a
          href={cellLink}
          target={cellTarget}
          data-link-tooltip
          data-original-title={cellLinkTooltip}
          data-placement="right"
        >
          {value}
        </a>
      );
    }

    // ??? I don't think this will still work!
    if (this.column.filterable) {
      cellClasses.push('table-panel-cell-filterable');
      value = (
        <>
          {value}
          <span>
            <a
              className="table-panel-filter-link"
              data-link-tooltip
              data-original-title="Filter out value"
              data-placement="bottom"
              data-row={props.rowIndex}
              data-column={props.columnIndex}
              data-operator="!="
            >
              <i className="fa fa-search-minus" />
            </a>
            <a
              className="table-panel-filter-link"
              data-link-tooltip
              data-original-title="Filter for value"
              data-placement="bottom"
              data-row={props.rowIndex}
              data-column={props.columnIndex}
              data-operator="="
            >
              <i className="fa fa-search-plus" />
            </a>
          </span>
        </>
      );
    }

    let className;
    if (cellClasses.length) {
      className = cellClasses.join(' ');
    }

    return simpleCellBuilder({ value, props, className });
  };
}
