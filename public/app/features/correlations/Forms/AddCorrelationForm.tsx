import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { Controller } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, PanelContainer, useStyles2 } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { useCorrelations } from '../useCorrelations';

import { CorrelationDetailsFormPart } from './CorrelationDetailsFormPart';
import { FormDTO } from './types';
import { useCorrelationForm } from './useCorrelationForm';

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

  const { create } = useCorrelations();

  const onSubmit = useCallback(
    async (correlation) => {
      await create.execute(correlation);
      onCreated();
    },
    [create, onCreated]
  );

  const { control, handleSubmit, register, errors } = useCorrelationForm<FormDTO>({ onSubmit });

  return (
    <PanelContainer className={styles.panelContainer}>
      <CloseButton onClick={onClose} />
      <form onSubmit={handleSubmit}>
        <div className={styles.horizontalGroup}>
          <Controller
            control={control}
            name="sourceUID"
            rules={{
              required: { value: true, message: 'This field is required.' },
              validate: {
                writable: (uid: string) =>
                  !getDatasourceSrv().getInstanceSettings(uid)?.readOnly || "Source can't be a read-only data source.",
              },
            }}
            render={({ field: { onChange, value } }) => (
              <Field label="Source" htmlFor="source" invalid={!!errors.sourceUID} error={errors.sourceUID?.message}>
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
            control={control}
            name="targetUID"
            rules={{ required: { value: true, message: 'This field is required.' } }}
            render={({ field: { onChange, value } }) => (
              <Field label="Target" htmlFor="target" invalid={!!errors.targetUID} error={errors.targetUID?.message}>
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

        <CorrelationDetailsFormPart register={register} />

        <HorizontalGroup justify="flex-end">
          <Button
            variant="primary"
            icon={create.loading ? 'fa fa-spinner' : 'plus'}
            type="submit"
            disabled={create.loading}
          >
            Add
          </Button>
        </HorizontalGroup>
      </form>
    </PanelContainer>
  );
};
