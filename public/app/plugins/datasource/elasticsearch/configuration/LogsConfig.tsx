import * as React from 'react';

import { ConfigDescriptionLink, ConfigSubSection } from '@grafana/plugin-ui';
import { Input, InlineField } from '@grafana/ui';

import { ElasticsearchOptions } from '../types';

type Props = {
  value: ElasticsearchOptions;
  onChange: (value: ElasticsearchOptions) => void;
};
export const LogsConfig = (props: Props) => {
  const { value, onChange } = props;
  const changeHandler =
    (key: keyof ElasticsearchOptions) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({
        ...value,
        [key]: event.currentTarget.value,
      });
    };

  return (
    <ConfigSubSection
      title="Logs"
      description={
        <ConfigDescriptionLink
          description="Configure which fields the data source uses for log messages and log levels."
          suffix="elasticsearch/#logs"
          feature="Elasticsearch log fields"
        />
      }
    >
      <InlineField
        label="Message field name"
        labelWidth={22}
        tooltip="Configure the field to be used for log messages."
      >
        <Input
          id="es_logs-config_logMessageField"
          value={value.logMessageField}
          onChange={changeHandler('logMessageField')}
          placeholder="_source"
          width={24}
        />
      </InlineField>

      <InlineField
        label="Level field name"
        labelWidth={22}
        tooltip="Configure the field that determines the level of each log message."
      >
        <Input
          id="es_logs-config_logLevelField"
          value={value.logLevelField}
          onChange={changeHandler('logLevelField')}
          width={24}
        />
      </InlineField>
    </ConfigSubSection>
  );
};
