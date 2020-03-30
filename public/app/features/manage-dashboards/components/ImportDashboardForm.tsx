import React, { FC, useEffect, useState } from 'react';
import { Forms, FormAPI, FormsOnSubmit, HorizontalGroup } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { DashboardInput, DashboardInputs, DataSourceInput, ImportDashboardDTO } from '../state/reducers';

interface Props extends Omit<FormAPI<ImportDashboardDTO>, 'formState'> {
  uidReset: boolean;
  inputs: DashboardInputs;
  uidExists: boolean;
  titleExists: boolean;
  initialFolderId: number;

  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<ImportDashboardDTO>;
  validateTitle: (value: string) => Promise<boolean>;
  validateUid: (value: string) => Promise<boolean | string>;
}

export const ImportDashboardForm: FC<Props> = ({
  register,
  errors,
  control,
  getValues,
  uidReset,
  inputs,
  uidExists,
  titleExists,
  initialFolderId,
  onUidReset,
  onCancel,
  onSubmit,
  validateUid,
  validateTitle,
}) => {
  const buttonVariant = uidExists || titleExists ? 'destructive' : 'primary';
  const buttonText = uidExists || titleExists ? 'Import (Overwrite)' : 'Import';

  const [isSubmitted, setSubmitted] = useState(false);

  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && (errors.title || errors.uid)) {
      onSubmit(getValues({ nest: true }), {} as any);
    }
  }, [errors]);

  return (
    <>
      <Forms.Legend>Options</Forms.Legend>
      <Forms.Field label="Name" invalid={!!errors.title} error={errors.title && errors.title.message}>
        <Forms.Input
          name="title"
          size="md"
          type="text"
          ref={register({ required: 'Name is required', validate: async (v: string) => await validateTitle(v) })}
        />
      </Forms.Field>
      <Forms.Field label="Folder">
        <Forms.InputControl
          as={FolderPicker}
          name="folderId"
          useNewForms
          initialFolderId={initialFolderId}
          control={control}
        />
      </Forms.Field>
      <Forms.Field
        label="Unique identifier (uid)"
        description="The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
                The uid allows having consistent URL’s for accessing dashboards so changing the title of a dashboard will not break any
                bookmarked links to that dashboard."
        invalid={!!errors.uid}
        error={errors.uid && errors.uid.message}
      >
        <>
          {!uidReset ? (
            <Forms.Input
              size="md"
              name="uid"
              disabled
              ref={register({ validate: async (v: string) => await validateUid(v) })}
              addonAfter={!uidReset && <Forms.Button onClick={onUidReset}>Change uid</Forms.Button>}
            />
          ) : (
            <Forms.Input
              size="md"
              name="uid"
              ref={register({ required: true, validate: async (v: string) => await validateUid(v) })}
            />
          )}
        </>
      </Forms.Field>
      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput, index: number) => {
          const dataSourceOption = `dataSources[${index}]`;
          return (
            <Forms.Field
              label={input.label}
              key={dataSourceOption}
              invalid={errors.dataSources && !!errors.dataSources[index]}
              error={errors.dataSources && errors.dataSources[index] && 'A data source is required'}
            >
              <Forms.InputControl
                as={DataSourcePicker}
                name={`${dataSourceOption}`}
                datasources={input.options}
                control={control}
                placeholder={input.info}
                rules={{ required: true }}
              />
            </Forms.Field>
          );
        })}
      {inputs.constants &&
        inputs.constants.map((input: DashboardInput, index) => {
          const constantIndex = `constants[${index}]`;
          return (
            <Forms.Field
              label={input.label}
              error={errors.constants && errors.constants[index] && `${input.label} needs a value`}
              invalid={errors.constants && !!errors.constants[index]}
              key={constantIndex}
            >
              <Forms.Input
                ref={register({ required: true })}
                name={`${constantIndex}`}
                size="md"
                defaultValue={input.value}
              />
            </Forms.Field>
          );
        })}
      <HorizontalGroup>
        <Forms.Button
          type="submit"
          variant={buttonVariant}
          onClick={() => {
            setSubmitted(true);
          }}
        >
          {buttonText}
        </Forms.Button>
        <Forms.Button type="reset" variant="secondary" onClick={onCancel}>
          Cancel
        </Forms.Button>
      </HorizontalGroup>
    </>
  );
};
