import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { PureComponent } from 'react';

import { GrafanaTheme, DataFrame, CSVConfig, readCSV } from '@grafana/data';

import { stylesFactory, withTheme } from '../../themes';
import { Themeable } from '../../types/theme';
import { Icon } from '../Icon/Icon';
import { TextArea } from '../TextArea/TextArea';

interface Props extends Themeable {
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
export class UnThemedTableInputCSV extends PureComponent<Props, State> {
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
    const { width, height, theme } = this.props;
    const { data } = this.state;
    const styles = getStyles(theme);
    return (
      <div className={styles.tableInputCsv}>
        <TextArea
          style={{ width, height }}
          placeholder="Enter CSV here..."
          value={this.state.text}
          onChange={this.onTextChange}
          className={styles.textarea}
        />
        {data && (
          <footer className={styles.footer}>
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

export const TableInputCSV = withTheme(UnThemedTableInputCSV);
TableInputCSV.displayName = 'TableInputCSV';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    tableInputCsv: css`
      position: relative;
    `,
    textarea: css`
      height: 100%;
      width: 100%;
    `,
    footer: css`
      position: absolute;
      bottom: 15px;
      right: 15px;
      border: 1px solid #222;
      background: ${theme.palette.online};
      padding: 1px ${theme.spacing.xs};
      font-size: 80%;
    `,
  };
});
