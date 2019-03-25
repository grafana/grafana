import React from 'react';
import debounce from 'lodash/debounce';
import { parseCSV, TableParseOptions, TableParseDetails } from '../../utils/processSeriesData';
import { SeriesData } from '../../types/data';
import { AutoSizer } from 'react-virtualized';

interface Props {
  options?: TableParseOptions;
  text: string;
  onTableParsed: (table: SeriesData, text: string) => void;
}

interface State {
  text: string;
  table: SeriesData;
  details: TableParseDetails;
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    // Shoud this happen in onComponentMounted?
    const { text, options, onTableParsed } = props;
    const details = {};
    const table = parseCSV(text, options, details);
    this.state = {
      text,
      table,
      details,
    };
    onTableParsed(table, text);
  }

  readCSV = debounce(() => {
    const details = {};
    const table = parseCSV(this.state.text, this.props.options, details);
    this.setState({ table, details });
  }, 150);

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { text } = this.state;
    if (text !== prevState.text || this.props.options !== prevProps.options) {
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

  onFooterClicked = (event: any) => {
    console.log('Errors', this.state);
    const message = this.state.details
      .errors!.map(err => {
        return err.message;
      })
      .join('\n');
    alert('CSV Parsing Errors:\n' + message);
  };

  onTextChange = (event: any) => {
    this.setState({ text: event.target.value });
  };

  render() {
    const { table, details } = this.state;

    const hasErrors = details.errors && details.errors.length > 0;
    const footerClassNames = hasErrors ? 'gf-table-input-csv-err' : '';

    return (
      <AutoSizer>
        {({ height, width }) => (
          <div className="gf-table-input-csv" style={{ width, height }}>
            <textarea placeholder="Enter CSV here..." value={this.state.text} onChange={this.onTextChange} />
            <footer onClick={this.onFooterClicked} className={footerClassNames}>
              Rows:{table.rows.length}, Columns:{table.fields.length} &nbsp;
              {hasErrors ? <i className="fa fa-exclamation-triangle" /> : <i className="fa fa-check-circle" />}
            </footer>
          </div>
        )}
      </AutoSizer>
    );
  }
}

export default TableInputCSV;
