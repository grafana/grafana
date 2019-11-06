import React, { PureComponent } from 'react';
import memoizeOne from 'memoize-one';
import {
  calculateFieldStats,
  calculateLogsLabelStats,
  calculateStats,
  Field,
  getParser,
  LinkModel,
  LogRowModel,
} from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogDetailsRow } from './LogDetailsRow';

type FieldDef = {
  key: string;
  value: string;
  links?: string[];
  fieldIndex?: number;
};

export interface Props extends Themeable {
  row: LogRowModel;
  getRows: () => LogRowModel[];
  onClickFilterLabel?: (key: string, value: string) => void;
  onClickFilterOutLabel?: (key: string, value: string) => void;
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

class UnThemedLogDetails extends PureComponent<Props> {
  getParser = memoizeOne(getParser);

  parseMessage = memoizeOne(
    (rowEntry): FieldDef[] => {
      const parser = this.getParser(rowEntry);
      if (!parser) {
        return [];
      }
      // Use parser to highlight detected fields
      const parsedFields = parser.getFields(rowEntry);
      const fields = parsedFields.map(field => {
        const key = parser.getLabelFromField(field);
        const value = parser.getValueFromField(field);
        return { key, value };
      });

      return fields;
    }
  );

  getDerivedFields = memoizeOne(
    (row: LogRowModel): FieldDef[] => {
      return (
        row.dataFrame.fields
          .map((field, index) => ({ ...field, index }))
          // Remove Id which we use for react key and entry field which we are showing as the log message.
          .filter((field, index) => 'id' !== field.name && row.entryFieldIndex !== index)
          // Filter out fields without values. For example in elastic the fields are parsed from the document which can
          // have different structure per row and so the dataframe is pretty sparse.
          .filter(field => {
            const value = field.values.get(row.rowIndex);
            // Not sure exactly what will be the empty value here. And we want to keep 0 as some values can be non
            // string.
            return value !== null && value !== undefined;
          })
          .map(field => {
            const { getFieldLinks } = this.props;
            const links = getFieldLinks ? getFieldLinks(field, row.rowIndex) : [];
            return {
              key: field.name,
              value: field.values.get(row.rowIndex).toString(),
              links: links.map(link => link.href),
              fieldIndex: field.index,
            };
          })
      );
    }
  );

  getAllFields = memoizeOne((row: LogRowModel) => {
    const fields = this.parseMessage(row.entry);
    const derivedFields = this.getDerivedFields(row);
    const fieldsMap = [...derivedFields, ...fields].reduce(
      (acc, field) => {
        // Strip enclosing quotes for hashing. When values are parsed from log line the quotes are kept, but if same
        // value is in the dataFrame it will be without the quotes. We treat them here as the same value.
        const value = field.value.replace(/(^")|("$)/g, '');
        const fieldHash = `${field.key}=${value}`;
        if (acc[fieldHash]) {
          acc[fieldHash].links = [...(acc[fieldHash].links || []), ...(field.links || [])];
        } else {
          acc[fieldHash] = field;
        }
        return acc;
      },
      {} as { [key: string]: FieldDef }
    );
    return Object.values(fieldsMap);
  });

  getStatsForParsedField = (key: string) => {
    const matcher = this.getParser(this.props.row.entry)!.buildMatcher(key);
    return calculateFieldStats(this.props.getRows(), matcher);
  };

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const labels = row.labels ? row.labels : {};
    const labelsAvailable = Object.keys(labels).length > 0;

    const fields = this.getAllFields(row);

    const parsedFieldsAvailable = fields && fields.length > 0;

    return (
      <div className={style.logsRowDetailsTable}>
        {labelsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Log labels">
              Log Labels:
            </div>
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
          </div>
        )}

        {parsedFieldsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Parsed fields">
              Parsed fields:
            </div>
            {fields.map(field => {
              const { key, value, links, fieldIndex } = field;
              return (
                <LogDetailsRow
                  key={`${key}=${value}`}
                  parsedKey={key}
                  parsedValue={value}
                  links={links}
                  getStats={() =>
                    fieldIndex === undefined
                      ? this.getStatsForParsedField(key)
                      : calculateStats(row.dataFrame.fields[fieldIndex].values.toArray())
                  }
                />
              );
            })}
          </div>
        )}
        {!parsedFieldsAvailable && !labelsAvailable && <div aria-label="No details">No details available</div>}
      </div>
    );
  }
}

export const LogDetails = withTheme(UnThemedLogDetails);
LogDetails.displayName = 'LogDetails';
