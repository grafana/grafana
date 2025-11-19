import { memo, useState, useEffect, useCallback } from 'react';

import {
  SelectableValue,
  getFieldDisplayName,
  AnnotationEvent,
  AnnotationEventMappings,
  AnnotationEventFieldMapping,
  formattedValueToString,
  AnnotationEventFieldSource,
  getValueFormat,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Select, Tooltip, Icon } from '@grafana/ui';

import { getAnnotationEventNames, AnnotationFieldInfo } from '../standardAnnotationSupport';
import { AnnotationQueryResponse } from '../types';

interface Props {
  response?: AnnotationQueryResponse;
  mappings?: AnnotationEventMappings;
  change: (mappings?: AnnotationEventMappings) => void;
}

export const AnnotationFieldMapper = memo(({ response, mappings, change }: Props) => {
  const [fieldNames, setFieldNames] = useState<Array<SelectableValue<string>>>([]);

  useEffect(() => {
    const panelData = response?.panelData;
    const frame = panelData?.series?.[0] ?? panelData?.annotations?.[0];
    if (frame && frame.fields) {
      const newFieldNames = frame.fields.map((f) => {
        const name = getFieldDisplayName(f, frame);

        let description = '';
        for (let i = 0; i < frame.length; i++) {
          if (i > 0) {
            description += ', ';
          }
          if (i > 2) {
            description += '...';
            break;
          }
          description += f.values[i];
        }

        if (description.length > 50) {
          description = description.substring(0, 50) + '...';
        }

        return {
          label: `${name} (${f.type})`,
          value: name,
          description,
        };
      });
      setFieldNames(newFieldNames);
    }
  }, [response]);

  const onFieldNameChange = useCallback(
    (k: keyof AnnotationEvent, v: SelectableValue<string>) => {
      const currentMappings = mappings || {};

      // in case of clearing the value
      if (!v) {
        const newMappings = { ...mappings };
        delete newMappings[k];
        change(newMappings);
        return;
      }

      const mapping = currentMappings[k] || {};

      change({
        ...currentMappings,
        [k]: {
          ...mapping,
          value: v.value,
          source: AnnotationEventFieldSource.Field,
        },
      });
    },
    [mappings, change]
  );

  const renderRow = useCallback(
    (row: AnnotationFieldInfo, mapping: AnnotationEventFieldMapping, first?: AnnotationEvent) => {
      let picker = [...fieldNames];
      const current = mapping.value;
      let currentValue = fieldNames.find((f) => current === f.value);
      if (current && !currentValue) {
        picker.push({
          label: current,
          value: current,
        });
      }

      let value = first ? first[row.key] : '';
      if (value && row.key.startsWith('time')) {
        const fmt = getValueFormat('dateTimeAsIso');
        value = formattedValueToString(fmt(value));
      }
      if (value === null || value === undefined) {
        value = ''; // empty string
      }

      return (
        <tr key={row.key}>
          <td>
            {row.label || row.key}{' '}
            {row.help && (
              <Tooltip content={row.help}>
                <Icon name="info-circle" />
              </Tooltip>
            )}
          </td>
          <td>
            <Select
              value={currentValue}
              options={picker}
              placeholder={row.placeholder || row.key}
              onChange={(v: SelectableValue<string>) => {
                onFieldNameChange(row.key, v);
              }}
              noOptionsMessage={t(
                'annotations.annotation-field-mapper.noOptionsMessage-unknown-field-names',
                'Unknown field names'
              )}
              allowCustomValue={true}
              isClearable
            />
          </td>
          <td>{`${value}`}</td>
        </tr>
      );
    },
    [fieldNames, onFieldNameChange]
  );

  const first = response?.events?.[0];
  const currentMappings = mappings || {};

  return (
    <table className="filter-table">
      <thead>
        <tr>
          <th>
            <Trans i18nKey="annotations.annotation-field-mapper.annotation">Annotation</Trans>
          </th>
          <th>
            <Trans i18nKey="annotations.annotation-field-mapper.from">From</Trans>
          </th>
          <th>
            <Trans i18nKey="annotations.annotation-field-mapper.first-value">First value</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {getAnnotationEventNames().map((row) => {
          return renderRow(row, currentMappings[row.key] || {}, first);
        })}
      </tbody>
    </table>
  );
});

AnnotationFieldMapper.displayName = 'AnnotationFieldMapper';
