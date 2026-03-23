import { useMemo, useState } from 'react';

import { QueryOptionGroup } from '@grafana/plugin-ui';
import { Box, Button, InlineField, InlineSwitch, Input } from '@grafana/ui';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';

import { useQuery } from './ElasticsearchQueryContext';
import { isMetricAggregationWithSettings } from './MetricAggregationsEditor/aggregations';
import { changeMetricSetting } from './MetricAggregationsEditor/state/actions';

interface Props {
  onFormat?: () => void;
  onChange?: (query: ElasticsearchDataQuery) => void;
  onRunQuery?: () => void;
}

export function ElasticsearchQueryOptions({ onFormat, onChange, onRunQuery }: Props) {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];
  const isCodeEditor = query.editorType === 'code';
  const firstMetricWithSettings =
    !isCodeEditor && firstMetric != null && isMetricAggregationWithSettings(firstMetric) ? firstMetric : null;

  const isLogs = firstMetricWithSettings?.type === 'logs';
  const isRawData = firstMetricWithSettings?.type === 'raw_data' || firstMetricWithSettings?.type === 'raw_document';
  const showSizeField = firstMetricWithSettings !== null && (isLogs || isRawData);
  const label = isLogs ? 'Limit' : 'Size';
  const settingName = isLogs ? 'limit' : 'size';
  const currentValue = showSizeField
    ? String((isLogs ? firstMetricWithSettings!.settings?.limit : firstMetricWithSettings!.settings?.size) ?? '')
    : '';

  const includeRuntimeFields = query.includeRuntimeFields ?? false;

  const collapsedInfo = useMemo(() => {
    const infoArray = [];
    if (showSizeField && currentValue) {
      infoArray.push(`${label}: ${currentValue}`);
    }
    if (!isCodeEditor && includeRuntimeFields) {
      infoArray.push('Runtime fields: enabled');
    }
    return infoArray;
  }, [showSizeField, currentValue, label, isCodeEditor, includeRuntimeFields]);

  let sizeField: React.ReactElement | null = null;

  const [localValue, setLocalValue] = useState(currentValue);

  if (showSizeField) {
    sizeField = (
      <InlineField
        label={label}
        labelWidth={16}
        tooltip="Maximum number of documents to return"
        htmlFor="es-size-field"
      >
        <Input
          id="es-size-field"
          type="number"
          width={10}
          placeholder="500"
          value={localValue}
          onChange={(e) => setLocalValue(e.currentTarget.value)}
          onBlur={(e) =>
            dispatch(
              changeMetricSetting({
                metric: firstMetricWithSettings,
                settingName,
                newValue: e.currentTarget.value,
              })
            )
          }
        />
      </InlineField>
    );
  }

  return (
    <Box backgroundColor="secondary" borderRadius="default">
      <QueryOptionGroup title="Options" collapsedInfo={collapsedInfo}>
        {sizeField}
        {!isCodeEditor && (
          <InlineField
            label="Include runtime fields"
            labelWidth={22}
            tooltip="When enabled, runtime fields defined in the index mapping will be included in the response"
            htmlFor="es-include-runtime-fields"
          >
            <InlineSwitch
              id="es-include-runtime-fields"
              value={includeRuntimeFields}
              onChange={(e) => {
                if (onChange) {
                  onChange({ ...query, includeRuntimeFields: e.currentTarget.checked });
                  onRunQuery?.();
                }
              }}
            />
          </InlineField>
        )}
        {onFormat != null && (
          <Button
            size="sm"
            variant="secondary"
            icon="brackets-curly"
            onClick={onFormat}
            tooltip="Format query (Shift+Alt+F)"
          >
            Format
          </Button>
        )}
      </QueryOptionGroup>
    </Box>
  );
}
