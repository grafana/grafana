import React, { FC, useState, useEffect } from 'react';
import { DataSourceInstanceSettings, GrafanaTheme, SelectableValue } from '@grafana/data';
import { Cascader, Field, Input, InputControl, stylesFactory, Select, CascaderOption } from '@grafana/ui';
import { config } from 'app/core/config';
import { css } from '@emotion/css';

import { getAllDataSources } from '../../utils/config';
import { fetchRulerRules } from '../../api/ruler';
import { getRulesDataSources } from '../../utils/datasource';
import { RuleEditorSection } from './RuleEditorSection';
import { useFormContext } from 'react-hook-form';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { getDataSourceSrv } from '@grafana/runtime';

const alertTypeOptions: SelectableValue[] = [
  {
    label: 'Threshold',
    value: RuleFormType.threshold,
    description: 'Metric alert based on a defined threshold',
  },
  {
    label: 'System or application',
    value: RuleFormType.system,
    description: 'Alert based on a system or application behavior. Based on Prometheus.',
  },
];

const AlertTypeSection: FC = () => {
  const styles = getStyles(config.theme);

  const { register, control, watch, errors } = useFormContext<RuleFormValues>();

  const alertType = watch('type');
  const datasource = watch('dataSource');
  const dataSourceOptions = useDatasourceSelectOptions(alertType);
  const folderOptions = useFolderSelectOptions(datasource);

  console.log(alertType, dataSourceOptions, folderOptions);

  return (
    <RuleEditorSection stepNo={1} title="Alert type">
      <Field
        className={styles.formInput}
        label="Alert name"
        error={errors?.name?.message}
        invalid={!!errors.name?.message}
      >
        <Input ref={register({ required: { value: true, message: 'Must enter an alert name' } })} name="name" />
      </Field>
      <div className={styles.flexRow}>
        <Field label="Alert type" className={styles.formInput} error={errors.type?.message}>
          <InputControl
            as={Select}
            name="type"
            options={alertTypeOptions}
            control={control}
            onChange={(values: SelectableValue[]) => values[0]?.value}
          />
        </Field>
        <Field className={styles.formInput} label="Select data source">
          <InputControl as={Select} name="dataSource" options={dataSourceOptions} control={control} />
        </Field>
      </div>
      <Field className={styles.formInput}>
        <InputControl
          as={Cascader}
          displayAllSelectedLevels={true}
          separator=" > "
          name="folder"
          options={folderOptions}
          control={control}
          changeOnSelect={false}
          onSelect={(value: any) => {
            console.log('sel', value);
          }}
        />
      </Field>
    </RuleEditorSection>
  );
};

const useDatasourceSelectOptions = (ruleFormType?: RuleFormType) => {
  const [datasourceOptions, setDataSourceOptions] = useState<SelectableValue[]>([]);

  useEffect(() => {
    let options = [] as ReturnType<typeof getAllDataSources>;
    if (ruleFormType) {
      if (ruleFormType === RuleFormType.threshold) {
        options = getDataSourceSrv().getList({ alerting: true });
      } else if (ruleFormType === RuleFormType.system) {
        options = getRulesDataSources();
      }
    }
    setDataSourceOptions(
      options.map(({ name, type, meta }) => {
        return {
          label: name,
          value: name,
          imgUrl: meta.info.logos.small,
        };
      })
    );
  }, [ruleFormType]);

  return datasourceOptions;
};

const useFolderSelectOptions = (datasource?: DataSourceInstanceSettings) => {
  const [folderOptions, setFolderOptions] = useState<CascaderOption[]>([]);

  useEffect(() => {
    if (datasource?.name) {
      fetchRulerRules(datasource?.name)
        .then((namespaces) => {
          const options: CascaderOption[] = Object.entries(namespaces).map(([namespace, group]) => {
            return {
              label: namespace,
              value: namespace,
              items: group.map(({ name }) => {
                return { label: name, value: { namespace, group: name } };
              }),
            };
          });
          setFolderOptions(options);
        })
        .catch((error) => {
          if (error.status === 404) {
            setFolderOptions([{ label: 'No folders found', value: '' }]);
          }
        });
    }
  }, [datasource]);

  return folderOptions;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    formInput: css`
      width: 330px;
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
});

export default AlertTypeSection;
