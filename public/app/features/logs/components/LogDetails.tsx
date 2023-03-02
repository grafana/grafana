import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { CoreApp, DataFrame, Field, GrafanaTheme2, LinkModel, LogRowModel } from '@grafana/data';
import { Themeable2, withTheme2 } from '@grafana/ui';

import { calculateLogsLabelStats, calculateStats } from '../utils';

import { LogDetailsRow } from './LogDetailsRow';
import { getLogLevelStyles, getLogRowStyles } from './getLogRowStyles';
import { getAllFields, FieldDef } from './logParser';

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
  displayedFields?: string[];
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

interface FieldDefArr extends FieldDef {
  keyArr: string[];
  valArr: string[];
}

class UnThemedLogDetails extends PureComponent<Props> {
  constructLogLineLink(logLineLink: FieldDef) {
    return;
  }

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
      displayedFields,
      getFieldLinks,
      wrapLogMessage,
    } = this.props;
    const rowStyles = getLogRowStyles(theme);
    const levelStyles = getLogLevelStyles(theme, row.logLevel);
    const styles = getStyles(theme);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;
    const fieldsAndLinks = getAllFields(row, getFieldLinks);
    let links = fieldsAndLinks.filter((f) => f.links?.length);
    const showLinks = links.filter((f) => f.fieldIndex !== row.entryFieldIndex).sort();
    const hiddenLinks = links.filter((f) => f.fieldIndex === row.entryFieldIndex).sort();
    const varMapLinks: FieldDefArr[] = [];

    // create route for log line links to be displayed
    hiddenLinks.forEach((linkField) => {
      linkField.links?.forEach((link) => {
        if (link.variableMap) {
          varMapLinks.push({
            key: linkField.key,
            value: linkField.value,
            keyArr: Object.keys(link.variableMap),
            valArr: Object.keys(link.variableMap).map((key) => link.variableMap?.[key]?.toString() || ''),
            links: [link],
            fieldIndex: linkField.fieldIndex,
          });
        }
      });
    });
    // do not show the log message unless there is a link attached
    //TODO FIX
    const fields = fieldsAndLinks.filter((f) => f.links?.length === 0 && f.fieldIndex !== row.entryFieldIndex).sort();
    const fieldsAvailable = fields && fields.length > 0;
    const linksAvailable = links && links.length > 0;

    // If logs with error, we are not showing the level color
    const levelClassName = hasError
      ? ''
      : `${levelStyles.logsRowLevelColor} ${rowStyles.logsRowLevel} ${styles.logsRowLevelDetails}`;

    return (
      <tr className={cx(className, styles.logDetails)}>
        {showDuplicates && <td />}
        <td className={levelClassName} aria-label="Log level" />
        <td colSpan={4}>
          <div className={rowStyles.logDetailsContainer}>
            <table className={rowStyles.logDetailsTable}>
              <tbody>
                {(labelsAvailable || fieldsAvailable) && (
                  <tr>
                    <td colSpan={100} className={rowStyles.logDetailsHeading} aria-label="Fields">
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
                        displayedFields={displayedFields}
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
                      getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())}
                      displayedFields={displayedFields}
                      wrapLogMessage={wrapLogMessage}
                      row={row}
                      app={app}
                    />
                  );
                })}

                {linksAvailable && (
                  <tr>
                    <td colSpan={100} className={rowStyles.logDetailsHeading} aria-label="Data Links">
                      Links
                    </td>
                  </tr>
                )}
                {showLinks.map((field) => {
                  const { key, value, links, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      links={links}
                      onClickShowField={onClickShowField}
                      onClickHideField={onClickHideField}
                      getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())}
                      displayedFields={displayedFields}
                      wrapLogMessage={wrapLogMessage}
                      row={row}
                      app={app}
                    />
                  );
                })}
                {varMapLinks?.map((field) => {
                  const { key, value, keyArr, valArr, links, fieldIndex } = field;
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}`}
                      parsedKey={key}
                      parsedValue={value}
                      parsedKeyArray={keyArr}
                      parsedValueArray={valArr}
                      links={links}
                      onClickShowField={onClickShowField}
                      onClickHideField={onClickHideField}
                      getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())}
                      displayedFields={displayedFields}
                      wrapLogMessage={wrapLogMessage}
                      row={row}
                      app={app}
                    />
                  );
                })}

                {!fieldsAvailable && !labelsAvailable && !linksAvailable && (
                  <tr>
                    <td colSpan={100} aria-label="No details">
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
