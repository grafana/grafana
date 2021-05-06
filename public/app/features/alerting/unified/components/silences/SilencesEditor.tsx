import { Silence, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';
import React, { FC } from 'react';
import { Alert, Button, Field, FieldSet, Input, LinkButton, TextArea, useStyles } from '@grafana/ui';
import { DefaultTimeZone, GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { pickBy } from 'lodash';
import MatchersField from './MatchersField';
import { useForm, FormProvider } from 'react-hook-form';
import { SilenceFormFields } from '../../types/silence-form';
import { useDispatch } from 'react-redux';
import { createOrUpdateSilenceAction } from '../../state/actions';
import { SilencePeriod } from './SilencePeriod';
import { css, cx } from '@emotion/css';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { makeAMLink } from '../../utils/misc';

interface Props {
  silence?: Silence;
  alertManagerSourceName: string;
}

const getDefaultFormValues = (silence?: Silence): SilenceFormFields => {
  if (silence) {
    return {
      id: silence.id,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Default time period is now + 2h
      comment: silence.comment,
      createdBy: silence.createdBy,
      duration: `2h`,
      isRegex: false,
      matchers: silence.matchers || [],
      matcherName: '',
      matcherValue: '',
      timeZone: DefaultTimeZone,
    };
  } else {
    return {
      id: '',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // Default time period is now + 2h
      comment: '',
      createdBy: config.bootData.user.name,
      duration: '2h',
      isRegex: false,
      matchers: [{ name: '', value: '', isRegex: false }],
      matcherName: '',
      matcherValue: '',
      timeZone: DefaultTimeZone,
    };
  }
};

export const SilencesEditor: FC<Props> = ({ silence, alertManagerSourceName }) => {
  const formAPI = useForm({ defaultValues: getDefaultFormValues(silence) });
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);

  const { loading, error } = useUnifiedAlertingSelector((state) => state.updateSilence);

  const { register, handleSubmit, formState } = formAPI;

  const onSubmit = (data: SilenceFormFields) => {
    const { id, startsAt, endsAt, comment, createdBy, matchers } = data;
    const payload = pickBy(
      {
        id,
        startsAt,
        endsAt,
        comment,
        createdBy,
        matchers,
      },
      (value) => !!value
    ) as SilenceCreatePayload;
    dispatch(
      createOrUpdateSilenceAction({
        alertManagerSourceName,
        payload,
        exitOnSave: true,
        successMessage: `Silence ${payload.id ? 'updated' : 'created'}`,
      })
    );
  };
  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label={`${silence ? 'Recreate silence' : 'Create silence'}`}>
          {error && (
            <Alert severity="error" title="Error saving silence">
              {error.message || (error as any)?.data?.message || String(error)}
            </Alert>
          )}
          <SilencePeriod />
          <MatchersField />
          <Field
            className={cx(styles.field, styles.textArea)}
            label="Comment"
            required
            error={formState.errors.comment?.message}
            invalid={!!formState.errors.comment}
          >
            <TextArea {...register('comment', { required: { value: true, message: 'Required.' } })} />
          </Field>
          <Field
            className={cx(styles.field, styles.createdBy)}
            label="Created by"
            required
            error={formState.errors.createdBy?.message}
            invalid={!!formState.errors.createdBy}
          >
            <Input {...register('createdBy', { required: { value: true, message: 'Required.' } })} />
          </Field>
        </FieldSet>
        <div className={styles.flexRow}>
          {loading && (
            <Button disabled={true} icon="fa fa-spinner" variant="primary">
              Saving...
            </Button>
          )}
          {!loading && <Button type="submit">Submit</Button>}
          <LinkButton
            href={makeAMLink('alerting/silences', alertManagerSourceName)}
            variant={'secondary'}
            fill="outline"
          >
            Cancel
          </LinkButton>
        </div>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  field: css`
    margin: ${theme.spacing.sm} 0;
  `,
  textArea: css`
    width: 600px;
  `,
  createdBy: css`
    width: 200px;
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;

    & > * {
      margin-right: ${theme.spacing.sm};
    }
  `,
});

export default SilencesEditor;
