import * as React from 'react';

import { t } from '@grafana/i18n';
import { Field, Switch } from '@grafana/ui';

import { AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  onBatchAPIEnabledChange: (batchAPIEnabled: boolean) => void;
}

export const BatchAPIToggle = (props: Props) => {
  const { options, onBatchAPIEnabledChange } = props;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => onBatchAPIEnabledChange(e.target.checked);

  return (
    <Field
      description={t(
        'components.batch-api-toggle.description-batch-api',
        'Enable the Azure Monitor Batch API for fetching metrics. This can improve performance when querying multiple resources.'
      )}
      label={t('components.batch-api-toggle.label-enable-batch-api', 'Enable Batch API')}
    >
      <div>
        <Switch
          aria-label={t('components.batch-api-toggle.aria-label-enable-batch-api', 'Batch API')}
          onChange={onChange}
          value={options.batchAPIEnabled ?? false}
        />
      </div>
    </Field>
  );
};
