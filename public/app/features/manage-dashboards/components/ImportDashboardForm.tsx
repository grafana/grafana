import React, { FC, useEffect, useState } from 'react';
import { Forms, HorizontalGroup } from '@grafana/ui';
import { FormContextValues, OnSubmit } from 'react-hook-form';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { ImportDashboardDTO } from './ImportDashboardOverview';

type FormAPI<T> = Pick<FormContextValues<T>, 'register' | 'errors' | 'control' | 'getValues'>;

interface Props extends FormAPI<ImportDashboardDTO> {
  uidReset: boolean;
  inputs: any[];
  uidExists: boolean;
  titleExists: boolean;

  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: OnSubmit<ImportDashboardDTO>;
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
  onUidReset,
  onCancel,
  onSubmit,
  validateUid,
  validateTitle,
}) => {
  const buttonVariant = uidExists || titleExists ? 'destructive' : 'primary';
  const buttonText = uidExists || titleExists ? 'Import (Overwrite)' : 'Import';

  const [isSubmitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length > 0) {
      onSubmit(getValues(), {} as any);
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
        <Forms.InputControl as={FolderPicker} name="folderId" useNewForms initialFolderId={0} control={control} />
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
      {inputs.map((input: any, index: number) => {
        if (input.type === 'datasource') {
          return (
            <Forms.Field label={input.label} key={`${input.label}-${index}`}>
              <Forms.InputControl
                as={DataSourcePicker}
                name="dataSource"
                datasources={input.options}
                control={control}
                current={null}
              />
            </Forms.Field>
          );
        }
        return null;
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
