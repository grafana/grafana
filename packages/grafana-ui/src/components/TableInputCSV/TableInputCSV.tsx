import React from 'react';
import debounce from 'lodash/debounce';
import { DataFrame, CSVConfig, readCSV } from '@grafana/data';
import { Icon } from '../Icon/Icon';

interface Props {
  config?: CSVConfig;
  text: string;
  width: string | number;
  height: string | number;
  onSeriesParsed: (data: DataFrame[], text: string) => void;
}

interface State {
  text: string;
  data: DataFrame[];
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
export class TableInputCSV extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { text, config } = props;
    this.state = {
      text,
      data: readCSV(text, { config }),
    };
  }

  readCSV: any = debounce(() => {
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
    const { width, height } = this.props;
    const { data } = this.state;
    return (
      <div className="gf-table-input-csv">
        <textarea
          style={{ width, height }}
          placeholder="Enter CSV here..."
          value={this.state.text}
          onChange={this.onTextChange}
          className="gf-form-input"
        />
        {data && (
          <footer>
            {data.map((frame, index) => {
              return (
                <span key={index}>
                  Rows:{frame.length}, Columns:{frame.fields.length} &nbsp;
                  <Icon name="check-circle" />
                </span>
              );
            })}
          </footer>
        )}
      </div>
    );
  }
}

export default TableInputCSV;
