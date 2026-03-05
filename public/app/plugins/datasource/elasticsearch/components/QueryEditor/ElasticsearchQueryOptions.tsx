import { QueryOptionGroup } from '@grafana/plugin-ui';
import { Box, Button, InlineField, Input } from '@grafana/ui';

import { useDispatch } from '../../hooks/useStatelessReducer';

import { useQuery } from './ElasticsearchQueryContext';
import { isMetricAggregationWithSettings } from './MetricAggregationsEditor/aggregations';
import { changeMetricSetting } from './MetricAggregationsEditor/state/actions';

interface Props {
  onFormat?: () => void;
}

export function ElasticsearchQueryOptions({ onFormat }: Props) {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];
  const isCodeEditor = query.editorType === 'code';
  const firstMetricWithSettings =
    !isCodeEditor && firstMetric != null && isMetricAggregationWithSettings(firstMetric) ? firstMetric : null;

  let sizeField: React.ReactElement | null = null;
  let collapsedInfo: string[] = [];

  if (firstMetricWithSettings !== null) {
    const isLogs = firstMetricWithSettings.type === 'logs';
    const isRawData =
      firstMetricWithSettings.type === 'raw_data' || firstMetricWithSettings.type === 'raw_document';

    if (isLogs || isRawData) {
      const label = isLogs ? 'Limit' : 'Size';
      const settingName = isLogs ? 'limit' : 'size';
      const currentValue = String((isLogs ? firstMetricWithSettings.settings?.limit : firstMetricWithSettings.settings?.size) ?? '');

      if (currentValue) {
        collapsedInfo = [`${label}: ${currentValue}`];
      }

      sizeField = (
        <InlineField label={label} labelWidth={16} tooltip="Maximum number of documents to return">
          <Input
            type="number"
            width={10}
            placeholder="500"
            value={currentValue}
            onChange={(e) =>
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
  }

  if (sizeField === null && onFormat == null) {
    return null;
  }

  return (
    <Box backgroundColor="secondary" borderRadius="default">
      <QueryOptionGroup title="Options" collapsedInfo={collapsedInfo}>
        {sizeField}
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
