import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

interface Props {
  onChange: (alertManagerSourceName: string) => void;
  current?: string;
  dataSources: AlertManagerDataSource[];
}

function getAlertManagerLabel(alertManager: AlertManagerDataSource) {
  return alertManager.name === GRAFANA_RULES_SOURCE_NAME ? 'Grafana' : alertManager.name.slice(0, 37);
}

export const AlertManagerPicker = ({ onChange, current, dataSources }: Props) => {
  const options: Array<SelectableValue<string>> = useMemo(() => {
    return dataSources.map((ds) => ({
      label: getAlertManagerLabel(ds),
      value: ds.name,
      imgUrl: ds.imgUrl,
      meta: ds.meta,
    }));
  }, [dataSources]);

  return (
    <Select
      aria-label={'Choose Alertmanager'}
      width={29}
      backspaceRemovesValue={false}
      onChange={(value) => value.value && onChange(value.value)}
      options={options}
      maxMenuHeight={500}
      noOptionsMessage="No datasources found"
      value={current}
      getOptionLabel={(o) => o.label}
    />
  );
};
