import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';

import { Field, LinkModel, LogRowModel, GrafanaTheme2, CoreApp, DataFrame } from '@grafana/data';
import { withTheme2, Themeable2, Icon, Tooltip } from '@grafana/ui';

import { calculateFieldStats, calculateLogsLabelStats, calculateStats, getParser } from '../utils';

import { LogDetailsRow } from './LogDetailsRow';
import { getLogRowStyles } from './getLogRowStyles';
import { getAllFields } from './logParser';

//Components

export interface Props extends Themeable2 {
  row: LogRowModel;
  showDuplicates: boolean;
  getRows: () => LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;
  app?: CoreApp;

  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getFieldLinks?: (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;
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
      app,
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
                        row={row}
                        app={app}
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
                            margin-left: ${theme.spacing(0.5)};
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
                      row={row}
                      app={app}
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

export const LogDetails = withTheme2(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
