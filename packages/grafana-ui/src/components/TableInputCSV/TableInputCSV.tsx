import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { PureComponent } from 'react';
import * as React from 'react';

import { DataFrame, CSVConfig, readCSV, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { withTheme2 } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { Themeable2 } from '../../types/theme';
import { Icon } from '../Icon/Icon';
import { TextArea } from '../TextArea/TextArea';

interface Props extends Themeable2 {
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

  onTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
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
          placeholder={t('grafana-ui.table.csv-placeholder', 'Enter CSV here...')}
          value={this.state.text}
          onChange={this.onTextChange}
          className={styles.textarea}
        />
        {data && (
          <footer className={styles.footer}>
            {data.map((frame, index) => {
              const rows = frame.length;
              const columns = frame.fields.length;
              return (
                <span key={index}>
                  <Trans i18nKey="grafana-ui.table.csv-counts">
                    Rows:{{ rows }}, Columns:{{ columns }} &nbsp;
                    <Icon name="check-circle" />
                  </Trans>
                </span>
              );
            })}
          </footer>
        )}
      </div>
    );
  }
}

/** @deprecated */
export const TableInputCSV = withTheme2(UnThemedTableInputCSV);
TableInputCSV.displayName = 'TableInputCSV';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    tableInputCsv: css({
      position: 'relative',
    }),
    textarea: css({
      height: '100%',
      width: '100%',
    }),
    footer: css({
      position: 'absolute',
      bottom: '15px',
      right: '15px',
      border: `1px solid ${theme.colors.success.border}`,
      background: theme.colors.success.main,
      color: theme.colors.success.contrastText,
      padding: `1px ${theme.spacing(0.5)}`,
      fontSize: '80%',
    }),
  };
});
