import { css, cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';

import { CoreApp, DataFrame, Field, GrafanaTheme2, LinkModel, LogRowModel } from '@grafana/data';
import { Themeable2, withTheme2 } from '@grafana/ui';

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
  showFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
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

  getStatsForField = (key: string) => {
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
      onClickShowField,
      onClickHideField,
      showFields: showFields,
      getFieldLinks,
      wrapLogMessage,
    } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const fieldsAndLinks = getAllFields(row, getFieldLinks);
    const links = fieldsAndLinks.filter((f) => f.links?.length).sort();
    const fields = fieldsAndLinks.filter((f) => f.links?.length === 0).sort();
    const fieldsAvailable = fields && fields.length > 0;
    const linksAvailable = links && links.length > 0;

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
                {(labelsAvailable || fieldsAvailable) && (
                  <tr>
                    <td colSpan={6} className={style.logDetailsHeading} aria-label="Fields">
                      Fields
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
                        onClickShowField={onClickShowField}
                        onClickHideField={onClickHideField}
                        row={row}
                        app={app}
                        wrapLogMessage={wrapLogMessage}
                        showFields={showFields}
                      />
                    );
                  })}
                {fields.map((field) => {
                  const { key, value, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      onClickShowField={onClickShowField}
                      onClickHideField={onClickHideField}
                      onClickFilterOutLabel={onClickFilterOutLabel}
                      onClickFilterLabel={onClickFilterLabel}
                      getStats={() =>
                        fieldIndex === undefined
                          ? this.getStatsForField(key)
                          : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())
                      }
                      showFields={showFields}
                      wrapLogMessage={wrapLogMessage}
                      row={row}
                      app={app}
                    />
                  );
                })}

                {linksAvailable && (
                  <tr>
                    <td colSpan={6} className={style.logDetailsHeading} aria-label="Fields">
                      Data Links
                    </td>
                  </tr>
                )}
                {links.map((field) => {
                  const { key, value, links, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      links={links}
                      onClickShowField={onClickShowField}
                      onClickHideField={onClickHideField}
                      getStats={() =>
                        fieldIndex === undefined
                          ? this.getStatsForField(key)
                          : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())
                      }
                      showFields={showFields}
                      wrapLogMessage={wrapLogMessage}
                      row={row}
                      app={app}
                    />
                  );
                })}
                {!fieldsAvailable && !labelsAvailable && !linksAvailable && (
                  <tr>
                    <td colSpan={6} aria-label="No details">
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
