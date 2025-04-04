import { css } from '@emotion/css';
import { pickBy } from 'lodash';
import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';
import { useDebounce } from 'react-use';

import {
  GrafanaTheme2,
  addDurationToDate,
  dateTime,
  intervalToAbbreviatedDurationString,
  isValidDate,
  parseDuration,
} from '@grafana/data';
import { config, isFetchError, locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  Field,
  FieldSet,
  Input,
  LinkButton,
  LoadingPlaceholder,
  Stack,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { SilenceCreatedResponse, alertSilencesApi } from 'app/features/alerting/unified/api/alertSilencesApi';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from 'app/features/alerting/unified/utils/datasource';
import { MatcherOperator, SilenceCreatePayload } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { SilenceFormFields } from '../../types/silence-form';
import { matcherFieldToMatcher } from '../../utils/alertmanager';
import { makeAMLink } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from '../GrafanaAlertmanagerDeliveryWarning';

import MatchersField from './MatchersField';
import { SilencePeriod } from './SilencePeriod';
import { SilencedInstancesPreview } from './SilencedInstancesPreview';
import { getDefaultSilenceFormValues, getFormFieldsForSilence } from './utils';

/**
 * Silences editor for editing an existing silence.
 *
 * Fetches silence details from API, based on `silenceId`
 */
const ExistingSilenceEditor = () => {
  const { id: silenceId = '' } = useParams();
  const { selectedAlertmanager: alertManagerSourceName = '' } = useAlertmanager();
  const {
    data: silence,
    isLoading: getSilenceIsLoading,
    error: errorGettingExistingSilence,
  } = alertSilencesApi.endpoints.getSilence.useQuery({
    id: silenceId,
    datasourceUid: getDatasourceAPIUid(alertManagerSourceName),
    ruleMetadata: true,
    accessControl: true,
  });
  const ruleUid = silence?.matchers?.find((m) => m.name === MATCHER_ALERT_RULE_UID)?.value;
  const isGrafanaAlertManager = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;

  const defaultValues = useMemo(() => {
    if (!silence) {
      return;
    }
    const filteredMatchers = silence.matchers?.filter((m) => m.name !== MATCHER_ALERT_RULE_UID);
    return getFormFieldsForSilence({ ...silence, matchers: filteredMatchers });
  }, [silence]);

  if (silenceId && getSilenceIsLoading) {
    return (
      <LoadingPlaceholder
        text={t(
          'alerting.existing-silence-editor.text-loading-existing-silence-information',
          'Loading existing silence information...'
        )}
      />
    );
  }

  const existingSilenceNotFound =
    isFetchError(errorGettingExistingSilence) && errorGettingExistingSilence.status === 404;

  if (existingSilenceNotFound) {
    return <Alert title={`Existing silence "${silenceId}" not found`} severity="warning" />;
  }

  const canEditSilence = isGrafanaAlertManager ? silence?.accessControl?.write : true;

  if (!canEditSilence) {
    return <Alert title={`You do not have permission to edit/recreate this silence`} severity="error" />;
  }

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={alertManagerSourceName} />
      <SilencesEditor ruleUid={ruleUid} formValues={defaultValues} alertManagerSourceName={alertManagerSourceName} />
    </>
  );
};

type SilencesEditorProps = {
  formValues?: SilenceFormFields;
  alertManagerSourceName: string;
  onSilenceCreated?: (response: SilenceCreatedResponse) => void;
  onCancel?: () => void;
  ruleUid?: string;
};

/**
 * Base silences editor used for new silences (from both the list view and the drawer),
 * and for editing existing silences
 */
export const SilencesEditor = ({
  formValues = getDefaultSilenceFormValues(),
  alertManagerSourceName,
  onSilenceCreated,
  onCancel,
  ruleUid,
}: SilencesEditorProps) => {
  const [previewAlertsSupported, previewAlertsAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.PreviewSilencedInstances
  );
  const canPreview = previewAlertsSupported && previewAlertsAllowed;

  const [createSilence, { isLoading }] = alertSilencesApi.endpoints.createSilence.useMutation();
  const formAPI = useForm({ defaultValues: formValues });
  const styles = useStyles2(getStyles);

  const { register, handleSubmit, formState, watch, setValue, clearErrors } = formAPI;

  const [duration, startsAt, endsAt, matchers] = watch(['duration', 'startsAt', 'endsAt', 'matchers']);

  /** Default action taken after creation or cancellation, if corresponding method is not defined */
  const defaultHandler = () => {
    locationService.push(makeAMLink('/alerting/silences', alertManagerSourceName));
  };

  const onSilenceCreatedHandler = onSilenceCreated || defaultHandler;
  const onCancelHandler = onCancel || defaultHandler;

  const onSubmit = async (data: SilenceFormFields) => {
    const { id, startsAt, endsAt, comment, createdBy, matchers: matchersFields } = data;

    if (ruleUid) {
      matchersFields.push({ name: MATCHER_ALERT_RULE_UID, value: ruleUid, operator: MatcherOperator.equal });
    }

    const matchersToSend = matchersFields.map(matcherFieldToMatcher).filter((field) => field.name && field.value);
    const payload = pickBy(
      {
        id,
        startsAt,
        endsAt,
        comment,
        createdBy,
        matchers: matchersToSend,
      },
      (value) => !!value
    ) as SilenceCreatePayload;
    await createSilence({ datasourceUid: getDatasourceAPIUid(alertManagerSourceName), payload })
      .unwrap()
      .then((newSilenceResponse) => {
        onSilenceCreatedHandler?.(newSilenceResponse);
      });
  };

  // Keep duration and endsAt in sync
  const [prevDuration, setPrevDuration] = useState(duration);
  useDebounce(
    () => {
      if (isValidDate(startsAt) && isValidDate(endsAt)) {
        if (duration !== prevDuration) {
          setValue('endsAt', dateTime(addDurationToDate(new Date(startsAt), parseDuration(duration))).toISOString());
          setPrevDuration(duration);
        } else {
          const startValue = new Date(startsAt).valueOf();
          const endValue = new Date(endsAt).valueOf();
          if (endValue > startValue) {
            const nextDuration = intervalToAbbreviatedDurationString({
              start: new Date(startsAt),
              end: new Date(endsAt),
            });
            setValue('duration', nextDuration);
            setPrevDuration(nextDuration);
          }
        }
      }
    },
    700,
    [clearErrors, duration, endsAt, prevDuration, setValue, startsAt]
  );
  const userLogged = Boolean(config.bootData.user.isSignedIn && config.bootData.user.name);

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet className={styles.formContainer}>
          <div className={styles.silencePeriod}>
            <SilencePeriod />
            <Field
              label={t('alerting.silences-editor.label-duration', 'Duration')}
              invalid={!!formState.errors.duration}
              error={
                formState.errors.duration &&
                (formState.errors.duration.type === 'required' ? 'Required field' : formState.errors.duration.message)
              }
            >
              <Input
                {...register('duration', {
                  validate: (value) =>
                    Object.keys(parseDuration(value)).length === 0
                      ? 'Invalid duration. Valid example: 1d 4h (Available units: y, M, w, d, h, m, s)'
                      : undefined,
                })}
                id="duration"
              />
            </Field>
          </div>

          <MatchersField required={Boolean(!ruleUid)} ruleUid={ruleUid} />

          <Field
            label={t('alerting.silences-editor.label-comment', 'Comment')}
            required
            error={formState.errors.comment?.message}
            invalid={!!formState.errors.comment}
          >
            <TextArea
              {...register('comment', { required: { value: true, message: 'Required.' } })}
              rows={5}
              placeholder={t(
                'alerting.silences-editor.comment-placeholder-details-about-the-silence',
                'Details about the silence'
              )}
              id="comment"
            />
          </Field>
          {!userLogged && (
            <Field
              label={t('alerting.silences-editor.label-created-by', 'Created By')}
              required
              error={formState.errors.createdBy?.message}
              invalid={!!formState.errors.createdBy}
            >
              <Input
                {...register('createdBy', { required: { value: true, message: 'Required.' } })}
                placeholder={t(
                  'alerting.silences-editor.placeholder-whos-creating-the-silence',
                  "Who's creating the silence"
                )}
              />
            </Field>
          )}
          {canPreview && (
            <SilencedInstancesPreview amSourceName={alertManagerSourceName} matchers={matchers} ruleUid={ruleUid} />
          )}
        </FieldSet>
        <Stack gap={1}>
          {isLoading && (
            <Button disabled={true} icon="spinner" variant="primary">
              <Trans i18nKey="alerting.silences-editor.saving">Saving...</Trans>
            </Button>
          )}
          {!isLoading && (
            <Button type="submit">
              <Trans i18nKey="alerting.silences-editor.save-silence">Save silence</Trans>
            </Button>
          )}
          <LinkButton onClick={onCancelHandler} variant={'secondary'}>
            <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
          </LinkButton>
        </Stack>
      </form>
    </FormProvider>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  formContainer: css({
    maxWidth: theme.breakpoints.values.md,
  }),
  alertRule: css({
    paddingBottom: theme.spacing(2),
  }),
  silencePeriod: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.spacing(1),
    maxWidth: theme.breakpoints.values.sm,
    paddingTop: theme.spacing(2),
  }),
});

function ExistingSilenceEditorPage() {
  const pageNav = {
    id: 'silence-edit',
    text: 'Edit silence',
    subTitle: 'Recreate existing silence to stop notifications from a particular alert rule',
  };
  return (
    <AlertmanagerPageWrapper navId="silences" pageNav={pageNav} accessType="instance">
      <ExistingSilenceEditor />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(ExistingSilenceEditorPage);
