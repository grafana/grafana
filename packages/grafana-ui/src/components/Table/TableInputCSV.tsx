import React from 'react';
import debounce from 'lodash/debounce';
import { ParseConfig, ParseResults, parseCSV } from '../../utils/processTableData';

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

    const hasErrors = errors.length > 0;

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
