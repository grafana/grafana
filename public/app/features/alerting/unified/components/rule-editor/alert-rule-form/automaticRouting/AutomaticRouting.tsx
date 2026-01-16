import { Controller, useFormContext } from 'react-hook-form';

import { PolicyRouting, RuleFormValues } from '../../../../types/rule-form';

import { NotificationPreview } from '../../notificaton-preview/NotificationPreview';
import { Combobox, ComboboxOption, Field, FieldValidationMessage, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { createRelativeUrl } from '../../../../utils/url';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../../../hooks/useAbilities';
import { t, Trans } from '@grafana/i18n';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { AlertManagerDataSource, grafanaAlertManagerDataSource } from '../../../../utils/datasource';
import {
  useListNotificationPolicyRoutes,
} from '../../../notification-policies/useNotificationPolicyRoute';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect } from 'react';
import { chain, countBy } from 'lodash';
import { AlertmanagerProvider } from '../../../../state/AlertmanagerContext';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

interface AutomaticRootingProps {
  alertUid?: string;
}

export function AutomaticRouting({ alertUid }: AutomaticRootingProps) {
  return (
  <Stack direction="column">
    <AlertmanagerProvider
      accessType={'notification'}
      alertmanagerSourceName={grafanaAlertManagerDataSource.name}
    >
      <AlertmanagerPolicyRouting alertmanager={grafanaAlertManagerDataSource} />
    </AlertmanagerProvider>
    <Preview alertUid={alertUid} />
  </Stack>
  );
}

interface PreviewProps {
  alertUid?: string;
}

function Preview({ alertUid }: PreviewProps) {
  const { watch } = useFormContext<RuleFormValues>();
  const [labels, queries, condition, folder, alertName, notificationPolicy] = watch([
    'labels',
    'queries',
    'condition',
    'folder',
    'name',
    'notificationPolicy',
    'manualRouting',
  ]);

  return (
    <NotificationPreview
      alertQueries={queries}
      customLabels={labels}
      condition={condition}
      folder={folder}
      alertName={alertName}
      alertUid={alertUid}
      policy={notificationPolicy?.selectedPolicy}
    />
  );
}


interface PolicyRoutingProps {
  alertmanager: AlertManagerDataSource;
}

function AlertmanagerPolicyRouting({ alertmanager }: PolicyRoutingProps) {
  const styles = useStyles2(getStyles);

  const [policiesSupported, canSeePoliciesTab] = useAlertmanagerAbility(AlertmanagerAction.ViewNotificationPolicyTree);

  if (!policiesSupported || !canSeePoliciesTab) return <></>;

  return (
    <Stack direction="row">
      <Stack direction="column">
        <Stack direction="row" alignItems="center">
          <div className={styles.firstAlertManagerLine} />
          <div className={styles.alertManagerName}>
            <Trans i18nKey="alerting.rule-form.simple-routing.alertmanager-label">Alertmanager:</Trans>
            <img src={alertmanager.imgUrl} alt="Alert manager logo" className={styles.img} />
            {alertmanager.name}
          </div>
          <div className={styles.secondAlertManagerLine} />
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <PolicySelector />
        </Stack>
      </Stack>
    </Stack>
  )
}

interface PolicySelectorProps {
}

function PolicySelector({ }: PolicySelectorProps) {
  const { control, trigger, watch } = useFormContext<RuleFormValues>();

  const policyField = `notificationPolicy`
  const policyInForm = watch(policyField)?.selectedPolicy;

  const { currentData, status, isLoading } = useListNotificationPolicyRoutes();

  // Check if form's policy still exists.
  const policyNotFound = policyInForm && status === QueryStatus.fulfilled && currentData?.find(policy => policy.name === policyInForm) === undefined;

  // validate the policy and check if it still exists when we've gotten a response from the API
  useEffect(() => {
    if (policyInForm && status === QueryStatus.fulfilled) {
      trigger(policyField, { shouldFocus: true });
    }
  }, [policyInForm, policyField, status, trigger]);

  // Create a mapping of options with their corresponding policy
  const policyOptions = chain(currentData)
    .toArray()
    .map((route) => ({
      option: {
        label: !route.name || route.name == "user-defined" ? 'Default Policy' : route.name,
        value: route.name ?? 'user-defined',
        description: getPolicyDescription(route),
      } satisfies ComboboxOption<string>,
      route,
    }))
    .value()
    .sort((a, b) => {
      if (a.option.label === 'Default Policy') return 1;
      if (b.option.label === 'Default Policy') return -1;
      return collator.compare(a.option.label, b.option.label);
    });
  const options = policyOptions.map<ComboboxOption>((item) => item.option);

  return (
    <Stack direction="row" alignItems="center">
      <Field
        noMargin
        label={t('alerting.policy-selector.policy-picker-label-policy', 'Policy')}
        data-testid="policy-picker"
      >
        <Controller
          name={policyField}
          render={({ field: { onChange }, fieldState: { error } }) => (
            <>
              <Stack>
                <Combobox
                  isClearable={false}
                  loading={isLoading}
                  options={options}
                  width={50}
                  value={policyInForm}
                  onChange={(selectedOption: ComboboxOption<string> | null) => {
                    if (selectedOption) {
                      const matchedOption = policyOptions.find(({ option }) => option.value === selectedOption.value);
                      if (!matchedOption) {
                        return;
                      }
                      const formValue : PolicyRouting = {
                        selectedPolicy: selectedOption.value
                      }
                      onChange(formValue)
                    }
                }}
                />
                <LinkToPolicies />
              </Stack>

              {/* Error can come from the required validation we have in here, or from the manual setError we do in the parent component.
              The only way I found to check the custom error is to check if the field has a value and if it's not in the options. */}

              {error && <FieldValidationMessage>{error?.message}</FieldValidationMessage>}
            </>
          )}
          rules={{
            validate: () => {
              if (policyNotFound) {
                return t(
                  'alerting.policy.validation.notFound',
                  `Policy "{{policy}}" could not be found`,
                  {
                    policy: policyInForm,
                  }
                );
              }
              return true;
            },
            required: {
              value: true,
              message: t(
                'alerting.policy-selector.message.policy-is-required',
                'Policy is required.'
              ),
            },
          }}
          control={control}
        />
      </Field>
    </Stack>
  );
}

function LinkToPolicies() {
  const hrefToContactPoints = '/alerting/routes';
  return (
    <TextLink
      external
      href={createRelativeUrl(hrefToContactPoints)}
      aria-label={t(
        'alerting.link-to-policies.aria-label-view-or-create-policies',
        'View or create notification policies'
      )}
    >
      <Trans i18nKey="alerting.link-to-policies.view-or-policies">
        View or create notification policies
      </Trans>
    </TextLink>
  );
}

function getPolicyDescription(route: Route): string {
  // Count the occurrences of each integration type
  const receiverCounts = countBy(route.routes, (r) => r.receiver);

  const description = Object.entries(receiverCounts)
    .map(([type, count]) => {
      // either "receiverA" or "receiverA (2)" but not "receiverA (1)"
      return count > 1 ? `${type} (${count})` : type;
    })
    .join(', ');

  return `Root: ${route.receiver} | Subroutes: ${description}`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  firstAlertManagerLine: css({
    height: 1,
    width: theme.spacing(4),
    backgroundColor: theme.colors.secondary.main,
  }),
  alertManagerName: css({
    with: 'fit-content',
  }),
  secondAlertManagerLine: css({
    height: '1px',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.secondary.main,
  }),
  img: css({
    marginLeft: theme.spacing(2),
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginRight: theme.spacing(1),
  }),
});
