import React from 'react';
import debounce from 'lodash/debounce';
import { TableData } from '../../types/data';
import { AutoSizer } from 'react-virtualized';
import { CSVParseConfig, readCSV } from '../../utils/csv';

interface Props {
  config?: CSVParseConfig;
  text: string;
  onTablesParsed: (tables: TableData[], text: string) => void;
}

interface State {
  text: string;
  tables: TableData[];
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { text, config, onTablesParsed } = props;

    readCSV(text, { config }).then(tables => {
      this.state = {
        text,
        tables,
      };
      onTablesParsed(tables, text);
    });
  }

  readCSV = debounce(() => {
    const { config } = this.props;
    const { text } = this.state;

    readCSV(text, { config }).then(tables => {
      this.setState({ tables });
    });
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

    if (this.state.tables !== prevState.tables) {
      this.props.onTablesParsed(this.state.tables, this.state.text);
    }
  }

  onTextChange = (event: any) => {
    this.setState({ text: event.target.value });
  };

  render() {
    const { tables } = this.state;

    return (
      <AutoSizer>
        {({ height, width }) => (
          <div className="gf-table-input-csv" style={{ width, height }}>
            <textarea placeholder="Enter CSV here..." value={this.state.text} onChange={this.onTextChange} />
            {tables && (
              <footer>
                Rows:{table.rows.length}, Columns:{table.columns.length} &nbsp;
                <i className="fa fa-check-circle" />
              </footer>
            )}
          </div>
        )}
      </AutoSizer>
    );
  }
}

export default TableInputCSV;
