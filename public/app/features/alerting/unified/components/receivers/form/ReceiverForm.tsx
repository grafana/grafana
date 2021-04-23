import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, Field, FieldArray, Input, LinkButton, useStyles } from '@grafana/ui';
import { NotifierDTO } from 'app/types';
import { merge } from 'lodash';
import React from 'react';
import { useForm, FormContext, NestDataObject, FieldError } from 'react-hook-form';
import { ChannelValues, ReceiverFormValues } from '../../../types/receiver-form';
import { makeAMLink } from '../../../utils/misc';
import { ChannelSubForm } from './ChannelSubForm';

/*const defaultCloudChannelConfig: CloudChannelValues = Object.freeze({
  type: 'email',
  settings: {},
  secureSettings: {},
  secureFields: {},
  sendResolved: true,
});*/

interface Props<R extends ChannelValues> {
  notifiers: NotifierDTO[];
  defaultItem: R;
  alertManagerSourceName: string;
  existing?: ReceiverFormValues<R>;
}

export function ReceiverForm<R extends ChannelValues>({
  existing,
  defaultItem,
  notifiers,
  alertManagerSourceName,
}: Props<ChannelValues>): JSX.Element {
  const styles = useStyles(getStyles);

  const formAPI = useForm<ReceiverFormValues<R>>({
    defaultValues: existing || {
      name: '',
      items: [defaultItem as any],
    },
  });

  const { handleSubmit, register, errors, control, getValues } = formAPI;

  const submit = (values: ReceiverFormValues<R>) => {
    console.log('submit', values);
  };

  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(submit)}>
        <h4 className={styles.heading}>{existing ? 'Update contact point' : 'Create contact point'}</h4>
        <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
          <Input width={39} name="name" ref={register({ required: 'Name is required' })} />
        </Field>
        <FieldArray name="items" control={control}>
          {({ fields, append, remove }) => {
            return (
              <>
                {fields.map((field, index) => {
                  return (
                    <ChannelSubForm<R>
                      key={field.id}
                      onDuplicate={() => {
                        const currentValues = getValues({ nest: true }).items[index];
                        append(merge({}, field, currentValues));
                      }}
                      onDelete={() => remove(index)}
                      pathPrefix={`items.${index}.`}
                      notifiers={notifiers}
                      defaults={field as R}
                      errors={errors?.items?.[index] as NestDataObject<R, FieldError>}
                    />
                  );
                })}
                <Button type="button" icon="plus" onClick={() => append(defaultItem)}>
                  New contact point type
                </Button>
              </>
            );
          }}
        </FieldArray>
        <div className={styles.buttons}>
          <Button type="submit">Save contact point</Button>
          <LinkButton variant="secondary" href={makeAMLink('/alerting/notifications', alertManagerSourceName)}>
            Cancel
          </LinkButton>
        </div>
      </form>
    </FormContext>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  heading: css`
    margin: ${theme.v2.spacing(4, 0)};
  `,
  buttons: css`
    margin-top: ${theme.v2.spacing(4)};

    & > * + * {
      margin-left: ${theme.v2.spacing(1)};
    }
  `,
});
