import { uniqueId } from 'lodash';
import { ComponentProps, useRef } from 'react';

import { InlineField, Input } from '@grafana/ui';
import { BucketAggregation } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig } from '../utils';

import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';
import { FiltersSettingsEditor } from './FiltersSettingsEditor';
import { TermsSettingsEditor } from './TermsSettingsEditor';
import { useDescription } from './useDescription';

export const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 18,
};

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor = ({ bucketAgg }: Props) => {
  const { current: baseId } = useRef(uniqueId('es-setting-'));

  const dispatch = useDispatch();

  const settingsDescription = useDescription(bucketAgg);

  return (
    <SettingsEditorContainer label={settingsDescription}>
      {bucketAgg.type === 'terms' && <TermsSettingsEditor bucketAgg={bucketAgg} />}
      {bucketAgg.type === 'date_histogram' && <DateHistogramSettingsEditor bucketAgg={bucketAgg} />}
      {bucketAgg.type === 'filters' && <FiltersSettingsEditor bucketAgg={bucketAgg} />}

      {bucketAgg.type === 'geohash_grid' && (
        <InlineField label="Precision" {...inlineFieldProps}>
          <Input
            id={`${baseId}-geohash_grid-precision`}
            onBlur={(e) =>
              dispatch(
                changeBucketAggregationSetting({ bucketAgg, settingName: 'precision', newValue: e.target.value })
              )
            }
            defaultValue={
              bucketAgg.settings?.precision || bucketAggregationConfig[bucketAgg.type].defaultSettings?.precision
            }
          />
        </InlineField>
      )}

      {bucketAgg.type === 'histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Input
              id={`${baseId}-histogram-interval`}
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: e.target.value })
                )
              }
              defaultValue={
                bucketAgg.settings?.interval || bucketAggregationConfig[bucketAgg.type].defaultSettings?.interval
              }
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              id={`${baseId}-histogram-min_doc_count`}
              onBlur={(e) =>
                dispatch(
                  changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })
                )
              }
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>
        </>
      )}
    </SettingsEditorContainer>
  );
};
