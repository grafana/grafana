import React from 'react';
import debounce from 'lodash/debounce';
import Papa, { ParseError, ParseMeta } from 'papaparse';
import { TableData, Column } from '../../types/data';

// Subset of all parse configs
export interface ParseConfig {
  delimiter?: string; // default: ","
  newline?: string; // default: "\r\n"
  quoteChar?: string; // default: '"'
  encoding?: string; // default: ""
  comments?: boolean | string; // default: false
}

interface ParseResults {
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
  width: number;
  height: number;
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
    console.log('GOT:', results);
  }, 150);

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.text !== prevState.text || this.props.config !== prevProps.config) {
      this.readCSV();
    }
  }

  handleChange = (event: any) => {
    this.setState({ text: event.target.value });
  };
  handleBlur = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    //  console.log('BLUR', event);
  };

  render() {
    const { width, height } = this.props;
    const { table, errors } = this.state.results;

    return (
      <div
        className={'gf-table-input-wrap'}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <textarea value={this.state.text} onChange={this.handleChange} onBlur={this.handleBlur} />
        <footer>
          BAR: / ROWS:{table.rows.length} / COLS:{table.columns.length} / {JSON.stringify(errors)}
        </footer>
      </div>
    );
  }
}

export default TableInputCSV;
