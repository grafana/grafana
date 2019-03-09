import React from 'react';
import debounce from 'lodash/debounce';
import { ParseConfig, parseCSV, ParseDetails } from '../../utils/processTableData';
import { TableData } from '../../types/data';

interface Props {
  config?: ParseConfig;
  width: number | string;
  height: number | string;
  text: string;
  onTableParsed: (table: TableData, text: string) => void;
}

interface State {
  text: string;
  table: TableData;
  details: ParseDetails;
}

class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    // Shoud this happen in onComponentMounted?
    const { text, config, onTableParsed } = props;
    const details = {};
    const table = parseCSV(text, config, details);
    this.state = {
      text,
      table,
      details,
    };
    onTableParsed(table, text);
  }

  readCSV = debounce(() => {
    const details = {};
    const table = parseCSV(this.state.text, this.props.config, details);
    this.setState({ table, details });
  }, 150);

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { text } = this.state;
    if (text !== prevState.text || this.props.config !== prevProps.config) {
      this.readCSV();
    }
    // If the props text has changed, replace our local version
    if (this.props.text !== prevProps.text && this.props.text !== text) {
      this.setState({ text: this.props.text });
    }

    if (this.state.table !== prevState.table) {
      this.props.onTableParsed(this.state.table, this.state.text);
    }
  }

  handleChange = (event: any) => {
    this.setState({ text: event.target.value });
  };

  render() {
    const { width, height } = this.props;
    const { table, details } = this.state;

    const hasErrors = details.errors && details.errors.length > 0;

    return (
      <div className="gf-table-input-csv" style={{ width, height }}>
        <textarea placeholder="Enter CSV here..." value={this.state.text} onChange={this.handleChange} />
        <footer>
          Rows:{table.rows.length}, Columns:{table.columns.length}
          {hasErrors ? <i className="fa fa-exclamation-triangle" /> : <i className="fa fa-check-circle" />}
        </footer>
      </div>
    );
  }
}

export default TableInputCSV;
