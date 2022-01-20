import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { QueryEditorRow } from '..';
import { SELECT_WIDTH } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { SLOQuery } from '../../types';

export interface Props {
  onChange: (query: SLOQuery) => void;
  query: SLOQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: CloudMonitoringDatasource;
}

export const Service: React.FC<Props> = ({ query, templateVariableOptions, onChange, datasource }) => {
  const [services, setServices] = useState<Array<SelectableValue<string>>>([]);
  const { projectName } = query;

  useEffect(() => {
    if (!projectName) {
      return;
    }

    datasource.getSLOServices(projectName).then((services: Array<SelectableValue<string>>) => {
      setServices([
        {
          label: 'Template Variables',
          options: templateVariableOptions,
        },
        ...services,
      ]);
    });
  }, [datasource, projectName, templateVariableOptions]);

  return (
    <QueryEditorRow label="Service">
      <Select
        menuShouldPortal
        aria-label="service"
        width={SELECT_WIDTH}
        allowCustomValue
        value={query?.serviceId && { value: query?.serviceId, label: query?.serviceName || query?.serviceId }}
        placeholder="Select service"
        options={services}
        onChange={({ value: serviceId = '', label: serviceName = '' }) =>
          onChange({ ...query, serviceId, serviceName, sloId: '' })
        }
      />
    </QueryEditorRow>
  );
};
