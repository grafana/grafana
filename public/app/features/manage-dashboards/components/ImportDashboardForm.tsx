import React, { FC, useEffect, useState } from 'react';
import {
  Button,
  FormAPI,
  FormsOnSubmit,
  HorizontalGroup,
  FormFieldErrors,
  Input,
  Field,
  InputControl,
  Legend,
} from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { DashboardInput, DashboardInputs, DataSourceInput, ImportDashboardDTO } from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';

interface Props extends Omit<FormAPI<ImportDashboardDTO>, 'formState'> {
  uidReset: boolean;
  inputs: DashboardInputs;
  initialFolderId: number;

  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<ImportDashboardDTO>;
}

export const ImportDashboardForm: FC<Props> = ({
  register,
  errors,
  control,
  getValues,
  uidReset,
  inputs,
  initialFolderId,
  onUidReset,
  onCancel,
  onSubmit,
}) => {
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
      <Legend>Options</Legend>
      <Field label="Name" invalid={!!errors.title} error={errors.title && errors.title.message}>
        <Input
          name="title"
          type="text"
          ref={register({
            required: 'Name is required',
            validate: async (v: string) => await validateTitle(v, getValues().folder.id),
          })}
        />
      </Field>
      <Field label="Folder">
        <InputControl
          as={FolderPicker}
          name="folder"
          useNewForms
          enableCreateNew
          initialFolderId={initialFolderId}
          control={control}
        />
      </Field>
      <Field
        label="Unique identifier (uid)"
        description="The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
                The uid allows having consistent URL’s for accessing dashboards so changing the title of a dashboard will not break any
                bookmarked links to that dashboard."
        invalid={!!errors.uid}
        error={errors.uid && errors.uid.message}
      >
        <>
          {!uidReset ? (
            <Input
              name="uid"
              disabled
              ref={register({ validate: async (v: string) => await validateUid(v) })}
              addonAfter={!uidReset && <Button onClick={onUidReset}>Change uid</Button>}
            />
          ) : (
            <Input name="uid" ref={register({ required: true, validate: async (v: string) => await validateUid(v) })} />
          )}
        </>
      </Field>
      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput, index: number) => {
          const dataSourceOption = `dataSources[${index}]`;
          return (
            <Field
              label={input.label}
              key={dataSourceOption}
              invalid={errors.dataSources && !!errors.dataSources[index]}
              error={errors.dataSources && errors.dataSources[index] && 'A data source is required'}
            >
              <InputControl
                as={DataSourcePicker}
                name={`${dataSourceOption}`}
                datasources={input.options}
                control={control}
                placeholder={input.info}
                rules={{ required: true }}
              />
            </Field>
          );
        })}
      {inputs.constants &&
        inputs.constants.map((input: DashboardInput, index) => {
          const constantIndex = `constants[${index}]`;
          return (
            <Field
              label={input.label}
              error={errors.constants && errors.constants[index] && `${input.label} needs a value`}
              invalid={errors.constants && !!errors.constants[index]}
              key={constantIndex}
            >
              <Input ref={register({ required: true })} name={`${constantIndex}`} defaultValue={input.value} />
            </Field>
          );
        })}
      <HorizontalGroup>
        <Button
          type="submit"
          variant={getButtonVariant(errors)}
          onClick={() => {
            setSubmitted(true);
          }}
        >
          {getButtonText(errors)}
        </Button>
        <Button type="reset" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </HorizontalGroup>
    </>
  );
};

function getButtonVariant(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'destructive' : 'primary';
}

function getButtonText(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'Import (Overwrite)' : 'Import';
}
