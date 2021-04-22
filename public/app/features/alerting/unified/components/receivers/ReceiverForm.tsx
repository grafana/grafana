import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, Field, FieldArray, Input, LinkButton, LoadingPlaceholder, useStyles } from '@grafana/ui';
import { GrafanaManagedReceiverConfig, Receiver } from 'app/plugins/datasource/alertmanager/types';
import { NotifierDTO } from 'app/types';
import React, { FC, useEffect } from 'react';
import { useForm, FormContext } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { ContactPointTypeSubform } from './ContactPointTypeSubform';

interface Values<R> {
  name: string;
  items: R[];
}

interface BaseChannelConfig {
  type: string;
}

interface CloudChannelConfig {
  type: string;
  send_resolved: boolean;
  [key: string]: unknown;
}

export const defaultCloudChannelConfig: CloudChannelConfig = Object.freeze({
  type: 'email',
  send_resolved: true,
});

const defaultGrafanaManagedReceiverConfig: GrafanaManagedReceiverConfig = Object.freeze({
  sendReminder: true,
  secureSettings: {},
  settings: {},
  disableResolveMessage: false,
  type: 'email',
  frequency: '15m',
  name: 'Email',
});

interface BaseProps {
  alertManagerSourceName: string;
  existing?: Receiver;
}

interface Props<R extends BaseChannelConfig> extends BaseProps {
  notifiers: NotifierDTO[];
  defaultItem: R;
}

function ReceiverForm<R extends BaseChannelConfig>({
  existing,
  defaultItem,
  notifiers,
  alertManagerSourceName,
}: Props<R>): JSX.Element {
  const styles = useStyles(getStyles);

  const formAPI = useForm<Values<R>>({
    defaultValues: {
      name: '',
      items: [defaultItem as any],
    },
  });

  const { handleSubmit, register, errors, control, getValues } = formAPI;

  const submit = (values: Values<R>) => {
    console.log('submit', values);
  };

  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(submit)}>
        <h4>{existing ? 'Update contact point' : 'Create contact point'}</h4>
        <Field label="Name" invalid={!!errors.name} error={errors.name && errors.name.message}>
          <Input width={39} name="name" ref={register({ required: 'Name is required' })} />
        </Field>
        <FieldArray name="items" control={control}>
          {({ fields, append, remove }) => {
            return (
              <>
                {fields.map((field, index) => {
                  console.log('f', field.type);
                  return (
                    <ContactPointTypeSubform<R>
                      key={field.id}
                      onDuplicate={() => {
                        const values = getValues({ nest: true }).items[index];
                        append(values);
                      }}
                      onDelete={() => remove(index)}
                      subPath={`items.${index}.`}
                      notifiers={notifiers}
                      defaults={field as R}
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

export const GrafanaReceiverForm: FC<BaseProps> = ({ existing, alertManagerSourceName }) => {
  const grafanaNotifiers = useUnifiedAlertingSelector((state) => state.grafanaNotifiers);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!(grafanaNotifiers.result || grafanaNotifiers.loading)) {
      dispatch(fetchGrafanaNotifiersAction());
    }
  }, [grafanaNotifiers, dispatch]);

  if (grafanaNotifiers.result) {
    return (
      <ReceiverForm<GrafanaManagedReceiverConfig>
        existing={existing}
        notifiers={grafanaNotifiers.result}
        alertManagerSourceName={alertManagerSourceName}
        defaultItem={defaultGrafanaManagedReceiverConfig}
      />
    );
  } else {
    return <LoadingPlaceholder text="Loading notifiers..." />;
  }
};

const getStyles = (theme: GrafanaTheme) => ({
  buttons: css`
    margin-top: ${theme.v2.spacing(4)};

    & > * + * {
      margin-left: ${theme.v2.spacing(1)};
    }
  `,
});
