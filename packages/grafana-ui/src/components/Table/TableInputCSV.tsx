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

  let same = true;
  let cols = data[0].length;
  data.forEach(row => {
    if (cols !== row.length) {
      same = false;
      cols = Math.max(cols, row.length);
    }
  });

  // Use a second pass to update the sizes
  if (!same) {
    errors.push({
      type: 'warning', // A generalization of the error
      message: 'not all rows have the same width',
      code: 'width',
      row: 0,
    });
    // Add null values to the end of all short arrays
    data.forEach(row => {
      const diff = cols - row.length;
      for (let i = 0; i < diff; i++) {
        row.push(null);
      }
    });
  }

  const first = results.data.shift();
  return {
    table: {
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
    } as TableData,
    meta,
    errors,
  };
}

interface Props {
  config?: ParseConfig;
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
    const { table, errors } = this.state.results;

    return (
      <div>
        <textarea value={this.state.text} onChange={this.handleChange} onBlur={this.handleBlur} />
        <div>
          BAR: / ROWS:{table.rows.length} / COLS:{table.columns.length} / {JSON.stringify(errors)}
        </div>
      </div>
    );
  }
}

export default TableInputCSV;
