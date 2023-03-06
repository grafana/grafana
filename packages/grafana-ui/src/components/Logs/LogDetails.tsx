import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';

import {
  calculateFieldStats,
  calculateLogsLabelStats,
  calculateStats,
  Field,
  getParser,
  LinkModel,
  LogRowModel,
  GrafanaTheme2,
} from '@grafana/data';

import { withTheme2 } from '../../themes/index';
import { Themeable2 } from '../../types/theme';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

import { LogDetailsRow } from './LogDetailsRow';
import { getLogRowStyles } from './getLogRowStyles';
import { getAllFields } from './logParser';

/** @deprecated will be removed in the next major version */
export interface Props extends Themeable2 {
  row: LogRowModel;
  showDuplicates: boolean;
  getRows: () => LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;

  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  showDetectedFields?: string[];
  onClickShowDetectedField?: (key: string) => void;
  onClickHideDetectedField?: (key: string) => void;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    logsRowLevelDetails: css`
      label: logs-row__level_details;
      &::after {
        top: -3px;
      }
    `,
    logDetails: css`
      label: logDetailsDefaultCursor;
      cursor: default;

      &:hover {
        background-color: ${theme.colors.background.primary};
      }
    `,
  };
};

class UnThemedLogDetails extends PureComponent<Props> {
  getParser = memoizeOne(getParser);

  getStatsForDetectedField = (key: string) => {
    const matcher = this.getParser(this.props.row.entry)!.buildMatcher(key);
    return calculateFieldStats(this.props.getRows(), matcher);
  };

  render() {
    const {
      row,
      theme,
      hasError,
      onClickFilterOutLabel,
      onClickFilterLabel,
      getRows,
      showDuplicates,
      className,
      onClickShowDetectedField,
      onClickHideDetectedField,
      showDetectedFields,
      getFieldLinks,
      wrapLogMessage,
    } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const fields = getAllFields(row, getFieldLinks);
    const detectedFieldsAvailable = fields && fields.length > 0;
    // If logs with error, we are not showing the level color
    const levelClassName = cx(!hasError && [style.logsRowLevel, styles.logsRowLevelDetails]);

    return (
      <tr className={cx(className, styles.logDetails)}>
        {showDuplicates && <td />}
        <td className={levelClassName} aria-label="Log level" />
        <td colSpan={4}>
          <div className={style.logDetailsContainer}>
            <table className={style.logDetailsTable}>
              <tbody>
                {labelsAvailable && (
                  <tr>
                    <td colSpan={5} className={style.logDetailsHeading} aria-label="Log labels">
                      Log labels
                    </td>
                  </tr>
                )}
                {Object.keys(labels)
                  .sort()
                  .map((key) => {
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

                {detectedFieldsAvailable && (
                  <tr>
                    <td colSpan={5} className={style.logDetailsHeading} aria-label="Detected fields">
                      Detected fields
                      <Tooltip content="Fields that are parsed from log message and detected by Grafana.">
                        <Icon
                          name="question-circle"
                          size="xs"
                          className={css`
                            margin-left: 4px;
                          `}
                        />
                      </Tooltip>
                    </td>
                  </tr>
                )}
                {fields.sort().map((field) => {
                  const { key, value, links, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      links={links}
                      onClickShowDetectedField={onClickShowDetectedField}
                      onClickHideDetectedField={onClickHideDetectedField}
                      getStats={() =>
                        fieldIndex === undefined
                          ? this.getStatsForDetectedField(key)
                          : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())
                      }
                      showDetectedFields={showDetectedFields}
                      wrapLogMessage={wrapLogMessage}
                    />
                  );
                })}
                {!detectedFieldsAvailable && !labelsAvailable && (
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

/** @deprecated will be removed in the next major version */
export const LogDetails = withTheme2(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
