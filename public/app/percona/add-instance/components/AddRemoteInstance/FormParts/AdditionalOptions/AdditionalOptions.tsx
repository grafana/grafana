import React, { FC, useEffect, useState } from 'react';
import {
  CheckboxField,
  NumberInputField,
  RadioButtonGroupField,
  TextInputField,
  validators as platformCoreValidators,
} from '@percona/platform-core';
import { useStyles } from '@grafana/ui';
import { AdditionalOptionsFormPartProps, PostgreSQLAdditionalOptionsProps } from '../FormParts.types';
import { getStyles } from '../FormParts.styles';
import { Messages } from '../FormParts.messages';
import { rdsTrackingOptions, trackingOptions } from '../FormParts.constants';
import { tablestatOptions } from './AdditionalOptions.constants';
import { TablestatOptionsInterface } from './AdditionalOptions.types';
import { FormApi } from 'final-form';
import { InstanceAvailableType, RemoteInstanceCredentials } from 'app/percona/add-instance/panel.types';
import { MysqlTLSCertificate } from './MysqlTLSCertificate';
import { MongodbTLSCertificate } from './MongodbTLSCertificate';
import { PostgreTLSCertificate } from './PostgreTLSCertificate';
import { Databases } from 'app/percona/shared/core';
import validators from 'app/percona/shared/helpers/validators';
import { noSymbolsValidator } from './validators';

export const AdditionalOptionsFormPart: FC<AdditionalOptionsFormPartProps> = ({
  instanceType,
  remoteInstanceCredentials,
  form,
}) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.groupWrapper}>
      <h4 className={styles.sectionHeader}>{Messages.form.titles.additionalOptions}</h4>
      <div>
        <CheckboxField
          label={Messages.form.labels.additionalOptions.skipConnectionCheck}
          name="skip_connection_check"
        />
        {getAdditionalOptions(instanceType, remoteInstanceCredentials, form)}
      </div>
    </div>
  );
};

export const PostgreSQLAdditionalOptions: FC<PostgreSQLAdditionalOptionsProps> = ({ isRDS, isAzure }) => (
  <>
    <RadioButtonGroupField
      name="tracking"
      data-testid="tracking-options-radio-button-group"
      options={isRDS || isAzure ? rdsTrackingOptions : trackingOptions}
      label={Messages.form.labels.trackingOptions}
    />
  </>
);

const getTablestatValues = (type: TablestatOptionsInterface) => {
  switch (type) {
    case TablestatOptionsInterface.disabled:
      return -1;
    default:
      return 1000;
  }
};

const MySQLOptions = ({ form }: { form: FormApi }) => {
  const selectedOption = form.getState().values && form.getState().values['tablestat-options'];
  const [selectedValue, setSelectedValue] = useState<string>(selectedOption || TablestatOptionsInterface.disabled);

  useEffect(() => {
    setSelectedValue(selectedOption);
    form.change('tablestats_group_table_limit', getTablestatValues(selectedOption));
  }, [selectedOption, form]);

  return (
    <>
      <RadioButtonGroupField
        name="tablestat-options"
        data-testid="tablestat-options-radio-button-group"
        defaultValue={selectedValue}
        options={tablestatOptions}
        label={Messages.form.labels.additionalOptions.tablestatOptions}
      />
      <NumberInputField
        name="tablestats_group_table_limit"
        defaultValue={-1}
        disabled={selectedValue !== TablestatOptionsInterface.custom}
        validate={platformCoreValidators.containsNumber}
      />
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
          <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
          <PostgreSQLAdditionalOptions
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
          <TextInputField
            name="disable_collectors"
            data-testid="disable-collectors-input-field"
            label={Messages.form.labels.additionalOptions.disableCollectors}
            placeholder={Messages.form.placeholders.additionalOptions.disableCollectors}
            validators={[noSymbolsValidator]}
          />
          <TextInputField
            name="stats_collections"
            data-testid="stats_collections-input-field"
            label={Messages.form.labels.additionalOptions.statsCollections}
            placeholder={Messages.form.placeholders.additionalOptions.statsCollections}
            tooltipText={Messages.form.tooltips.additionalOptions.statsCollections}
            tooltipIcon={'info-circle'}
          />
          <NumberInputField
            name="collections_limit"
            data-testid="collections-limit-input-field"
            label={Messages.form.labels.additionalOptions.collectionsLimit}
            placeholder={Messages.form.placeholders.additionalOptions.collectionsLimit}
            inputProps={{ min: -1 }}
            validators={[validators.min(-1)]}
            defaultValue={100}
          />
        </>
      );
    case Databases.haproxy:
      return null;
    default:
      return (
        <>
          <CheckboxField label={Messages.form.labels.additionalOptions.tls} name="tls" />
          <CheckboxField label={Messages.form.labels.additionalOptions.tlsSkipVerify} name="tls_skip_verify" />
        </>
      );
  }
};
