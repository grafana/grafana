import React, { FC, useEffect, useState } from 'react';
import { Select, InputControl } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { getRulesDataSources } from '../utils/datasource';
import { getAllDataSources } from '../utils/config';
import { ALERT_TYPE } from './rule-editor/AlertTypeSection';
import { AlertRuleFormMethods } from './rule-editor/AlertRuleForm';

interface Props {
  className?: string;
  control?: AlertRuleFormMethods['control'];
  alertType?: ALERT_TYPE;
  onChange?: (item: SelectableValue) => void;
  value?: string;
}

const DataSourceSelect: FC<Props> = ({ alertType, className, control, onChange, value }) => {
  const dataSourceOptions = useDatasourceSelectOptions(alertType);

  if (control) {
    return (
      <InputControl
        className={className}
        as={Select}
        control={control}
        name={'dataSource'}
        options={dataSourceOptions}
      />
    );
  } else if (onChange) {
    return <Select className={className} options={dataSourceOptions} onChange={onChange} value={value} />;
  } else {
    return null;
  }
};

const useDatasourceSelectOptions = (alertType?: ALERT_TYPE) => {
  const [datasourceOptions, setDataSourceOptions] = useState<SelectableValue[]>([]);

  useEffect(() => {
    let options = [] as ReturnType<typeof getAllDataSources>;
    if (alertType === ALERT_TYPE.SYSTEM) {
      options = getRulesDataSources();
    } else {
      options = getAllDataSources().filter(({ type }) => type !== 'datasource');
    }
    setDataSourceOptions(
      options.map(({ name, type }) => {
        return {
          label: name,
          value: name,
          description: type,
        };
      })
    );
  }, [alertType]);

  return datasourceOptions;
};

export default DataSourceSelect;
