import React from 'react';
import debounce from 'lodash/debounce';
import { SeriesData } from '../../types/data';
import { AutoSizer } from 'react-virtualized';
import { CSVConfig, readCSV } from '../../utils/csv';

interface Props {
  config?: CSVConfig;
  text: string;
  onSeriesParsed: (data: SeriesData[], text: string) => void;
}

interface State {
  text: string;
  data: SeriesData[];
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { text, config } = props;
    this.state = {
      text,
      data: readCSV(text, { config }),
    };
  }

  readCSV = debounce(() => {
    const { config } = this.props;
    const { text } = this.state;

    this.setState({ data: readCSV(text, { config }) });
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

    if (this.state.data !== prevState.data) {
      this.props.onSeriesParsed(this.state.data, this.state.text);
    }
  }

  onTextChange = (event: any) => {
    this.setState({ text: event.target.value });
  };

  render() {
    const { data } = this.state;

    return (
      <AutoSizer>
        {({ height, width }) => (
          <div className="gf-table-input-csv" style={{ width, height }}>
            <textarea placeholder="Enter CSV here..." value={this.state.text} onChange={this.onTextChange} />
            {data && (
              <footer>
                {data.map((series, index) => {
                  return (
                    <span key={index}>
                      Rows:{series.rows.length}, Columns:{series.fields.length} &nbsp;
                      <i className="fa fa-check-circle" />
                    </span>
                  );
                })}
              </footer>
            )}
          </div>
        )}
      </AutoSizer>
    );
  }
}

export default TableInputCSV;
