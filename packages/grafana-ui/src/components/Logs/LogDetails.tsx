import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import { css, cx } from 'emotion';
import {
  calculateFieldStats,
  calculateLogsLabelStats,
  calculateStats,
  Field,
  getParser,
  LinkModel,
  LogRowModel,
  GrafanaTheme,
} from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';
import { selectThemeVariant } from '../../themes/selectThemeVariant';

import { getAllFields } from './logParser';

//Components
import { LogDetailsRow } from './LogDetailsRow';

export interface Props extends Themeable {
  row: LogRowModel;
  showDuplicates: boolean;
  getRows: () => LogRowModel[];
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  showParsedFields?: string[];
  onClickShowParsedField?: (key: string) => void;
  onClickHideParsedField?: (key: string) => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = selectThemeVariant({ light: theme.palette.gray7, dark: theme.palette.dark2 }, theme.type);
  return {
    hoverBackground: css`
      label: hoverBackground;
      background-color: ${bgColor};
    `,
    logsRowLevelDetails: css`
      label: logs-row__level_details;
      &::after {
        top: -3px;
      }
    `,
    logDetailsDefaultCursor: css`
      label: logDetailsDefaultCursor;
      cursor: default;
    `,
  };
});

class UnThemedLogDetails extends PureComponent<Props> {
  getParser = memoizeOne(getParser);

  getStatsForParsedField = (key: string) => {
    const matcher = this.getParser(this.props.row.entry)!.buildMatcher(key);
    return calculateFieldStats(this.props.getRows(), matcher);
  };

  render() {
    const {
      row,
      theme,
      onClickFilterOutLabel,
      onClickFilterLabel,
      getRows,
      showDuplicates,
      className,
      onMouseEnter,
      onMouseLeave,
      onClickShowParsedField,
      onClickHideParsedField,
      showParsedFields,
      getFieldLinks,
    } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const fields = getAllFields(row, getFieldLinks);
    const parsedFieldsAvailable = fields && fields.length > 0;

    return (
      <tr
        className={cx(className, styles.logDetailsDefaultCursor)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {showDuplicates && <td />}
        <td className={cx(style.logsRowLevel, styles.logsRowLevelDetails)} />
        <td colSpan={4}>
          <div className={style.logDetailsContainer}>
            <table className={style.logDetailsTable}>
              <tbody>
                {labelsAvailable && (
                  <tr>
                    <td colSpan={5} className={style.logDetailsHeading} aria-label="Log Labels">
                      Log Labels:
                    </td>
                  </tr>
                )}
                {Object.keys(labels).map(key => {
                  const value = labels[key];
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      isLabel={true}
                      getStats={() => calculateLogsLabelStats(getRows(), key)}
                      onClickFilterOutLabel={onClickFilterOutLabel}
                      onClickFilterLabel={onClickFilterLabel}
                    />
                  );
                })}

                {parsedFieldsAvailable && (
                  <tr>
                    <td colSpan={5} className={style.logDetailsHeading} aria-label="Parsed Fields">
                      Parsed Fields:
                    </td>
                  </tr>
                )}
                {fields.map(field => {
                  const { key, value, links, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      links={links}
                      onClickShowParsedField={onClickShowParsedField}
                      onClickHideParsedField={onClickHideParsedField}
                      getStats={() =>
                        fieldIndex === undefined
                          ? this.getStatsForParsedField(key)
                          : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())
                      }
                      showParsedFields={showParsedFields}
                    />
                  );
                })}
                {!parsedFieldsAvailable && !labelsAvailable && (
                  <tr>
                    <td colSpan={5} aria-label="No details">
                      No details available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
