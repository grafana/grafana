import React, { PureComponent } from 'react';
import { groupBy } from 'lodash';
import memoizeOne from 'memoize-one';
import { Field, getParser, LinkModel, LogRowModel, LogsParser } from '@grafana/data';

import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';

//Components
import { LogDetailsRow } from './LogDetailsRow';

type FieldDef = {
  key: string;
  value: string;
  links?: string[];
  isDerived?: boolean;
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
  parseMessage = memoizeOne(
    (rowEntry: string): { fields: FieldDef[]; parser?: LogsParser } => {
      const parser = getParser(rowEntry);
      if (!parser) {
        return { fields: [] };
      }
      // Use parser to highlight detected fields
      const parsedFields = parser.getFields(rowEntry);
      const fields = parsedFields.map(field => {
        const key = parser.getLabelFromField(field);
        const value = parser.getValueFromField(field);
        return { key, value };
      });

      return { fields, parser };
    }
  );

  getDataFrameFields = memoizeOne(
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
              isDerived: !!(field.config && field.config.isDerived),
              fieldIndex: field.index,
            };
          })
      );
    }
  );

  render() {
    const { row, theme, onClickFilterOutLabel, onClickFilterLabel, getRows } = this.props;
    const style = getLogRowStyles(theme, row.logLevel);
    const { fields: parsedFields, parser } = this.parseMessage(row.entry);

    const dataFrameFields = this.getDataFrameFields(row);
    const dataFrameFieldsGrouped = groupBy(dataFrameFields, field => (field.isDerived ? 'derived' : 'normal'));

    const labels = row.labels ? row.labels : {};
    // Map labels to same format as other fields
    const labelFields: FieldDef[] = Object.keys(labels).map(key => ({ key, value: labels[key] }));
    // TODO: We could show non derived fields from dataFrame as labels. This would make sense for Elastic but there
    //  are few issues with that. In case of elastic we can get __source field which is also flattened into fields
    //  so each would be duplicated once in parsed fields and once in labels
    // const allLabels: FieldDef[] = [...labelFields, ...(dataFrameFieldsGrouped.normal || [])];

    const labelsAvailable = labelFields.length > 0;
    const parsedFieldsAvailable = parsedFields && parsedFields.length > 0;
    const derivedFieldsAvailable = dataFrameFieldsGrouped.derived && dataFrameFieldsGrouped.derived.length > 0;

    return (
      <div className={style.logsRowDetailsTable}>
        {labelsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Log labels">
              Log Labels:
            </div>
            {labelFields.map(label => {
              return (
                <LogDetailsRow
                  key={`${label.key}=${label.value}`}
                  parsedKey={label.key}
                  parsedValue={label.value}
                  getRows={getRows}
                  isLabel={!label.isDerived}
                  isDataFrameField={label.isDerived}
                  onClickFilterOutLabel={onClickFilterOutLabel}
                  onClickFilterLabel={onClickFilterLabel}
                  links={label.links}
                  fieldIndex={label.fieldIndex}
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
            {parsedFields.map(field => {
              const { key, value } = field;
              return (
                <LogDetailsRow
                  key={`${key}=${value}`}
                  parsedKey={key}
                  parsedValue={value}
                  getRows={getRows}
                  parser={parser}
                />
              );
            })}
          </div>
        )}

        {derivedFieldsAvailable && (
          <div className={style.logsRowDetailsSectionTable}>
            <div className={style.logsRowDetailsHeading} aria-label="Parsed fields">
              Derived fields:
            </div>
            {dataFrameFieldsGrouped.derived.map(field => {
              const { key, value, links, fieldIndex } = field;
              return (
                <LogDetailsRow
                  key={`${key}=${value}`}
                  parsedKey={key}
                  parsedValue={value}
                  links={links}
                  isDataFrameField={true}
                  fieldIndex={fieldIndex}
                  getRows={getRows}
                  parser={parser}
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
