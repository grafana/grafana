import React from 'react';
import { DataFrame, getFieldDisplayName, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import {
  configMapHandlers,
  FieldToConfigMapping,
  lookUpConfigHandler,
} from '../fieldToConfigMapping/fieldToConfigMapping';
import { capitalize } from 'lodash';

interface Props {
  frame: DataFrame;
  mappings: FieldToConfigMapping[];
  onChange: (mappings: FieldToConfigMapping[]) => void;
}

export function FieldToConfigMappingEditor({ frame, mappings, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const rows = getViewModelRows(frame, mappings);
  const configProps: Array<SelectableValue<string | undefined>> = configMapHandlers.map((def) => ({
    label: capitalize(def.key),
    value: def.key,
  }));

  const onChangeConfigProperty = (row: FieldToConfigRowViewModel, value: SelectableValue<string | undefined>) => {
    const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);

    if (value) {
      if (existingIdx !== -1) {
        const update = [...mappings];
        update.splice(existingIdx, 1, { ...mappings[existingIdx], configProperty: value.value! });
        onChange(update);
      } else {
        onChange([...mappings, { fieldName: row.fieldName, configProperty: value.value! }]);
      }
    } else {
      if (existingIdx !== -1) {
        onChange(mappings.filter((x, index) => index !== existingIdx));
      } else {
        // mark it as ignored
        onChange([...mappings, { fieldName: row.fieldName, configProperty: null }]);
      }
    }
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.headerCell}>Field name</th>
          <th className={styles.headerCell}>Maps to config</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.fieldName}>
            <td className={styles.labelCell}>{row.fieldName}</td>
            <td className={styles.selectCell}>
              <Select
                options={configProps}
                value={row.configHandlerKey}
                isClearable={true}
                onChange={(value) => onChangeConfigProperty(row, value)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface FieldToConfigRowViewModel {
  configHandlerKey: string | null;
  fieldName: string;
  isAutomatic: boolean;
  missingInFrame?: boolean;
}

function getViewModelRows(frame: DataFrame, mappings: FieldToConfigMapping[]): FieldToConfigRowViewModel[] {
  const rows: Record<string, FieldToConfigRowViewModel> = {};

  for (const field of frame.fields) {
    const fieldName = getFieldDisplayName(field, frame);
    const mapping = mappings.find((x) => x.fieldName === fieldName);
    const key = mapping ? mapping.configProperty : fieldName.toLowerCase();
    const handler = lookUpConfigHandler(key);

    rows[fieldName] = {
      fieldName,
      isAutomatic: mapping !== null,
      configHandlerKey: handler?.key ?? null,
    };
  }

  // Add rows for mappings that have no matching field
  for (const mapping of mappings) {
    if (!rows[mapping.fieldName]) {
      rows[mapping.fieldName] = {
        fieldName: mapping.fieldName,
        configHandlerKey: mapping.configProperty,
        isAutomatic: false,
        missingInFrame: true,
      };
    }
  }

  return Object.values(rows);
}

const getStyles = (theme: GrafanaTheme2) => ({
  mappings: css`
    flex-grow: 1;
  `,
  table: css`
    td,
    th {
      border-right: 4px solid ${theme.colors.background.primary};
      border-bottom: 4px solid ${theme.colors.background.primary};
      white-space: nowrap;
      min-width: 158px;
    }
  `,
  headerCell: css`
    background: ${theme.colors.background.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.spacing(4)};
    padding: ${theme.spacing(0, 1)};
  `,
  labelCell: css`
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0, 1)};
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  selectCell: css`
    padding: 0;
  `,
});
