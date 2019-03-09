import React from 'react';
import debounce from 'lodash/debounce';
import Papa, { ParseError, ParseMeta } from 'papaparse';
import { TableData, Column } from '../../types/data';

// Subset of all parse options
export interface ParseConfig {
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: ""
  comments?: boolean | string; // default: false
}

export interface ParseResults {
  table: TableData;
  meta: ParseMeta;
  errors: ParseError[];
}

// This mutates the table structure!
export function checkAndFix(table: TableData): number {
  let cols = table.columns.length;
  let different = 0;
  table.rows.forEach(row => {
    if (cols !== row.length) {
      different++;
      cols = Math.max(cols, row.length);
    }
  });
  if (different > 0) {
    if (cols !== table.columns.length) {
      const diff = cols - table.columns.length;
      for (let i = 0; i < diff; i++) {
        table.columns.push({
          text: 'Column ' + table.columns.length,
        });
      }
    }
    table.rows.forEach(row => {
      const diff = cols - row.length;
      for (let i = 0; i < diff; i++) {
        row.push(null);
      }
    });
  }
  return different;
}

export function parseCSV(text: string, config?: ParseConfig): ParseResults {
  const results = Papa.parse(text, { ...config, dynamicTyping: true, skipEmptyLines: true });

  const { data, meta, errors } = results;
  if (!data || data.length < 1) {
    if (!text) {
      errors.length = 0; // clear other errors
    }
    errors.push({
      type: 'warning', // A generalization of the error
      message: 'Empty Data',
      code: 'empty',
      row: 0,
    });
    return {
      table: {
        columns: [],
        rows: [],
        type: 'table',
        columnMap: {},
      } as TableData,
      meta,
      errors,
    };
  }

  const first = results.data.shift();
  const table = {
    columns: first.map((v: any, index: number) => {
      if (!v) {
        v = 'Column ' + (index + 1);
      }
      return {
        text: v.toString().trim(),
      } as Column;
    }),
    rows: results.data,
    type: 'table',
    columnMap: {},
  } as TableData;

  const changed = checkAndFix(table);
  if (changed > 0) {
    errors.push({
      type: 'warning', // A generalization of the error
      message: 'not all rows have the same width. Changed:' + changed,
      code: 'width',
      row: 0,
    });
  }
  return {
    table,
    meta,
    errors,
  };
}

interface Props {
  config?: ParseConfig;
  width: number | string;
  height: number | string;
  onTableParsed: (results: ParseResults) => void;
}

interface State {
  text: string;
  results: ParseResults;
}

class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      text: '',
      results: parseCSV('', this.props.config),
    };
  }

  readCSV = debounce(() => {
    const results = parseCSV(this.state.text, this.props.config);
    this.setState({ results });
  }, 150);

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.text !== prevState.text || this.props.config !== prevProps.config) {
      this.readCSV();
    }
    if (this.state.results !== prevState.results) {
      this.props.onTableParsed(this.state.results);
    }
  }

  handleChange = (event: any) => {
    this.setState({ text: event.target.value });
  };

  render() {
    const { width, height } = this.props;
    const { table, errors } = this.state.results;

    let clazz = 'fa fa-check-circle';
    errors.forEach(error => {
      if (error.type === 'warning') {
        clazz = 'fa fa-exclamation-triangle';
      } else {
        clazz = 'fa fa-times-circle';
      }
    });

    return (
      <div className="gf-table-input-csv" style={{ width, height }}>
        <textarea placeholder="Enter CSV here..." value={this.state.text} onChange={this.handleChange} />
        <footer>
          Rows:{table.rows.length}, Columns:{table.columns.length} <i className={clazz} />
        </footer>
      </div>
    );
  }
}

export default TableInputCSV;
