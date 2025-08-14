import { FormApi } from 'final-form';
import { FC, useEffect, useState } from 'react';

import { useStyles2 } from '@grafana/ui';
import {
  InstanceAvailableType,
  InstanceTypesExtra,
  RemoteInstanceCredentials,
} from 'app/percona/add-instance/panel.types';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { Databases } from 'app/percona/shared/core';
import Validators from 'app/percona/shared/helpers/validators';
import { validators as platformCoreValidators } from 'app/percona/shared/helpers/validatorsForm';

import { rdsTrackingOptions, trackingOptions } from '../FormParts.constants';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { AdditionalOptionsFormPartProps, PostgreSQLAdditionalOptionsProps } from '../FormParts.types';

import { autoDiscoveryOptions, tablestatOptions, maxConnectionLimitOptions } from './AdditionalOptions.constants';
import {
  AutoDiscoveryOptionsInterface,
  MaxConnectionLimitOptionsInterface,
  TablestatOptionsInterface,
} from './AdditionalOptions.types';
import { MongodbTLSCertificate } from './MongodbTLSCertificate';
import MysqlExtraDSNParams from './MysqlExtraDSNParams';
import { MysqlTLSCertificate } from './MysqlTLSCertificate';
import { PostgreTLSCertificate } from './PostgreTLSCertificate';

export const AdditionalOptionsFormPart: FC<AdditionalOptionsFormPartProps> = ({
  instanceType,
  remoteInstanceCredentials,
  form,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.additionalOptions}</h4>
      <div className={styles.additionalOptions}>
        <CheckboxField
          label={Messages.form.labels.additionalOptions.skipConnectionCheck}
          name="skip_connection_check"
        />
        {getAdditionalOptions(instanceType, remoteInstanceCredentials, form)}
      </div>
    </div>
  );
};

export const PostgreSQLAdditionalOptions: FC<PostgreSQLAdditionalOptionsProps> = ({ form, isRDS, isAzure }) => {
  const selectedOption = form.getState()?.values?.autoDiscoveryOptions;
  const maxConnSelectedOption = form.getState()?.values?.maxConnectionLimitOptions;
  const [selectedValue, setSelectedValue] = useState<string>(selectedOption || AutoDiscoveryOptionsInterface.enabled);
  const [maxConnSelectedValue, setMaxConnSelectedValue] = useState<string>(
    maxConnSelectedOption || MaxConnectionLimitOptionsInterface.disabled
  );
  const styles = useStyles2(getStyles);
  const validators = [platformCoreValidators.containsNumber, platformCoreValidators.int32];
  const maxConnValidators = [Validators.min(0), platformCoreValidators.int32];

  const getAutoDiscoveryLimitValue = (type: AutoDiscoveryOptionsInterface) =>
    type === AutoDiscoveryOptionsInterface.disabled ? -1 : 10;

  const getMaxConnectionLimitValue = (type: MaxConnectionLimitOptionsInterface) =>
    type === MaxConnectionLimitOptionsInterface.disabled ? null : 5;

  useEffect(() => {
    setSelectedValue(selectedOption);
    form.change('autoDiscoveryLimit', getAutoDiscoveryLimitValue(selectedOption));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption]);

  useEffect(() => {
    setMaxConnSelectedValue(maxConnSelectedOption);
    form.change(
      isRDS ? 'maxPostgresqlExporterConnections' : 'maxExporterConnections',
      getMaxConnectionLimitValue(maxConnSelectedOption)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxConnSelectedOption]);

  return (
    <>
      <h4>{Messages.form.labels.trackingOptions}</h4>
      <RadioButtonGroupField
        name="tracking"
        data-testid="tracking-options-radio-button-group"
        options={isRDS || isAzure ? rdsTrackingOptions : trackingOptions}
        className={styles.radioField}
        fullWidth
      />
      <h4>{Messages.form.labels.postgresqlDetails.autoDiscovery}</h4>
      <div className={styles.group}>
        <RadioButtonGroupField
          name="autoDiscoveryOptions"
          data-testid="auto-discovery-options-radio-button-group"
          defaultValue={selectedValue}
          options={autoDiscoveryOptions}
          className={styles.radioField}
          label={Messages.form.labels.postgresqlDetails.autoDiscoveryLimitOptions}
          fullWidth
        />
        <NumberInputField
          key="autoDiscoveryLimit"
          name="autoDiscoveryLimit"
          defaultValue={0}
          disabled={selectedValue !== AutoDiscoveryOptionsInterface.custom}
          validators={validators}
          label={Messages.form.labels.postgresqlDetails.autoDiscoveryLimit}
          tooltipText={Messages.form.tooltips.postgresqlDetails.autoDiscoveryLimit}
        />
      </div>
      {!isAzure && (
        <div>
          <h4>{Messages.form.labels.postgresqlDetails.maxConnection}</h4>
          <div className={styles.group}>
            <RadioButtonGroupField
              name="maxConnectionLimitOptions"
              data-testid="max-connection-limit-radio-button-group"
              defaultValue={maxConnSelectedValue}
              options={maxConnectionLimitOptions}
              className={styles.radioField}
              label={Messages.form.labels.postgresqlDetails.maxConnectionLimitOptions}
              fullWidth
            />
            <NumberInputField
              key={isRDS ? 'maxPostgresqlExporterConnections' : 'maxExporterConnections'}
              name={isRDS ? 'maxPostgresqlExporterConnections' : 'maxExporterConnections'}
              defaultValue={5}
              placeholder={'5'}
              validators={
                maxConnSelectedValue === MaxConnectionLimitOptionsInterface.enabled ? maxConnValidators : undefined
              }
              disabled={maxConnSelectedValue !== MaxConnectionLimitOptionsInterface.enabled}
              label={Messages.form.labels.postgresqlDetails.maxConnectionLimit}
              tooltipText={Messages.form.tooltips.postgresqlDetails.maxConnectionLimit}
            />
          </div>
        </div>
      )}
    </>
  );
};

const getTablestatValues = (type: TablestatOptionsInterface) => {
  switch (type) {
    case TablestatOptionsInterface.disabled:
      return -1;
    default:
      return 1000;
  }
};

const MySQLOptions = ({ form }: { form: FormApi }) => {
  const selectedOption = form.getState().values && form.getState().values.tablestatOptions;
  const [selectedValue, setSelectedValue] = useState<string>(selectedOption || TablestatOptionsInterface.disabled);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setSelectedValue(selectedOption);
    form.change('tablestats_group_table_limit', getTablestatValues(selectedOption));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption]);

  return (
    <>
      <div className={styles.extraDsnOptions}>
        <MysqlExtraDSNParams />
      </div>
      <h4>{Messages.form.labels.additionalOptions.tablestatOptions}</h4>
      <div className={styles.group}>
        <RadioButtonGroupField
          name="tablestatOptions"
          data-testid="tablestat-options-radio-button-group"
          defaultValue={selectedValue}
          options={tablestatOptions}
          className={styles.radioField}
          label={Messages.form.labels.additionalOptions.tablestatOptionsState}
          fullWidth
        />
        <NumberInputField
          name="tablestats_group_table_limit"
          defaultValue={-1}
          disabled={selectedValue !== TablestatOptionsInterface.custom}
          validate={platformCoreValidators.containsNumber}
          label={Messages.form.labels.additionalOptions.tablestatOptionsLimit}
        />
      </div>
    </>
  );
};

export const getAdditionalOptions = (
  type: InstanceAvailableType,
  remoteInstanceCredentials: RemoteInstanceCredentials,
  form: FormApi
) => {
  switch (type) {
    case Databases.postgresql:
      return (
        <>
          <CheckboxField label={Messages.form.labels.additionalOptions.tls} name="tls" />
          <PostgreTLSCertificate form={form} />
          <>
            <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
            <CheckboxField
              label={Messages.form.labels.additionalOptions.disableCommentsParsing}
              name="disable_comments_parsing"
            />
          </>
          <PostgreSQLAdditionalOptions
            form={form}
            isRDS={remoteInstanceCredentials.isRDS}
            isAzure={remoteInstanceCredentials.isAzure}
          />
          {remoteInstanceCredentials.isRDS ? (
            <>
              <CheckboxField
                label={Messages.form.labels.additionalOptions.disableBasicMetrics}
                name="disable_basic_metrics"
              />
              <CheckboxField
                label={Messages.form.labels.additionalOptions.disableEnchancedMetrics}
                name="disable_enhanced_metrics"
              />
            </>
          ) : null}
          {remoteInstanceCredentials.isAzure ? (
            <CheckboxField
              label={Messages.form.labels.additionalOptions.azureDatabaseExporter}
              name="azure_database_exporter"
            />
          ) : null}
        </>
      );
    case Databases.mysql:
      return (
        <>
          <CheckboxField label={Messages.form.labels.additionalOptions.tls} name="tls" />
          <MysqlTLSCertificate form={form} />
          <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
          <MySQLOptions form={form} />
          <CheckboxField
            label={Messages.form.labels.additionalOptions.disableCommentsParsing}
            name="disable_comments_parsing"
          />
          <CheckboxField
            label={Messages.form.labels.additionalOptions.qanMysqlPerfschema}
            name="qan_mysql_perfschema"
          />
          {remoteInstanceCredentials.isRDS ? (
            <>
              <CheckboxField
                label={Messages.form.labels.additionalOptions.disableBasicMetrics}
                name="disable_basic_metrics"
              />
              <CheckboxField
                label={Messages.form.labels.additionalOptions.disableEnchancedMetrics}
                name="disable_enhanced_metrics"
              />
            </>
          ) : null}
          {remoteInstanceCredentials.isAzure ? (
            <CheckboxField
              label={Messages.form.labels.additionalOptions.azureDatabaseExporter}
              name="azure_database_exporter"
            />
          ) : null}
        </>
      );
    case Databases.mongodb:
      return (
        <>
          <CheckboxField label={Messages.form.labels.additionalOptions.tls} name="tls" />
          <MongodbTLSCertificate form={form} />
          <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
          <CheckboxField
            name="qan_mongodb_profiler"
            data-testid="qan-mongodb-profiler-checkbox"
            label={Messages.form.labels.additionalOptions.qanMongodbProfiler}
          />
        </>
      );
    case InstanceTypesExtra.external:
    case Databases.haproxy:
      return <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />;
    default:
      return (
        <>
          <CheckboxField label={Messages.form.labels.additionalOptions.tls} name="tls" />
          <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
        </>
      );
  }
};
