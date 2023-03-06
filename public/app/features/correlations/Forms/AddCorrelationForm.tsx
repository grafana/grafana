import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, PanelContainer, useStyles2 } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { useCorrelations } from '../useCorrelations';

import { CorrelationDetailsFormPart } from './CorrelationDetailsFormPart';
import { FormDTO } from './types';

const getStyles = (theme: GrafanaTheme2) => ({
  panelContainer: css`
    position: relative;
    padding: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `,
  linksToContainer: css`
    flex-grow: 1;
    /* This is the width of the textarea minus the sum of the label&description fields,
     * so that this element takes exactly the remaining space and the inputs will be
     * nicely aligned with the textarea
    **/
    max-width: ${theme.spacing(80 - 64)};
    margin-top: ${theme.spacing(3)};
    text-align: right;
    padding-right: ${theme.spacing(1)};
  `,
  // we can't use HorizontalGroup because it wraps elements in divs and sets margins on them
  horizontalGroup: css`
    display: flex;
  `,
});

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);

export const AddCorrelationForm = ({ onClose, onCreated }: Props) => {
  const styles = useStyles2(getStyles);

  const {
    create: { execute, loading, error, value },
  } = useCorrelations();

  useEffect(() => {
    if (!error && !loading && value) {
      onCreated();
    }
  }, [error, loading, value, onCreated]);

  const methods = useForm<FormDTO>({ defaultValues: { config: { type: 'query', target: {} } } });

  return (
    <PanelContainer className={styles.panelContainer}>
      <CloseButton onClick={onClose} />
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(execute)}>
          <div className={styles.horizontalGroup}>
            <Controller
              control={methods.control}
              name="sourceUID"
              rules={{
                required: { value: true, message: 'This field is required.' },
                validate: {
                  writable: (uid: string) =>
                    !getDatasourceSrv().getInstanceSettings(uid)?.readOnly ||
                    "Source can't be a read-only data source.",
                },
              }}
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Source"
                  htmlFor="source"
                  invalid={!!methods.formState.errors.sourceUID}
                  error={methods.formState.errors.sourceUID?.message}
                >
                  <DataSourcePicker
                    onChange={withDsUID(onChange)}
                    noDefault
                    current={value}
                    inputId="source"
                    width={32}
                  />
                </Field>
              )}
            />
            <div className={styles.linksToContainer}>Links to</div>
            <Controller
              control={methods.control}
              name="targetUID"
              rules={{ required: { value: true, message: 'This field is required.' } }}
              render={({ field: { onChange, value } }) => (
                <Field
                  label="Target"
                  htmlFor="target"
                  invalid={!!methods.formState.errors.targetUID}
                  error={methods.formState.errors.targetUID?.message}
                >
                  <DataSourcePicker
                    onChange={withDsUID(onChange)}
                    noDefault
                    current={value}
                    inputId="target"
                    width={32}
                  />
                </Field>
              )}
            />
          </div>

          <CorrelationDetailsFormPart />

          <HorizontalGroup justify="flex-end">
            <Button variant="primary" icon={loading ? 'fa fa-spinner' : 'plus'} type="submit" disabled={loading}>
              Add
            </Button>
          </HorizontalGroup>
        </form>
      </FormProvider>
    </PanelContainer>
  );
};
