import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { notificationsAPIv0alpha1 } from '@grafana/alerting/unstable';
import type { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Combobox,
  ComboboxOption,
  Field,
  Input,
  Label,
  RadioButtonGroup,
  Stack,
  Text,
  TextArea,
  TextLink,
  useStyles2,
} from '@grafana/ui';

import { RuleFormValues } from '../types/rule-form';

import { NeedHelpInfoForNotificationPolicy } from './rule-editor/NotificationsStep';

// Centralized form path for selected contact point
const CONTACT_POINT_PATH = 'contactPoints.grafana.selectedContactPoint' as const;

export function RuleNotificationSection() {
  const styles = useStyles2(getStyles);

  const { watch, setValue } = useFormContext<RuleFormValues>();
  const manualRouting = watch('manualRouting');
  const useNotificationPolicy = !manualRouting;
  const selectedContactPoint = watch(CONTACT_POINT_PATH);
  // Fetch contact points from Alerting API v0alpha1
  const { currentData, status, refetch } = notificationsAPIv0alpha1.endpoints.listReceiver.useQuery({});
  const options = useMemo<Array<ComboboxOption<string>>>(
    () =>
      (currentData?.items ?? []).map((item) => ({
        value: item?.spec?.title ?? '',
        label: item?.spec?.title ?? '',
      })),
    [currentData]
  );

  const recipientLabelId = 'recipient-label';

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <span className={styles.stepBadge}>
          <Trans i18nKey="alerting.simplified.step-number-three">3</Trans>
        </span>
        <div className={styles.sectionHeader}>
          <Trans i18nKey="alerting.simplified.notification.title">Notification</Trans>
        </div>
      </div>

      <div className={styles.contentIndented}>
        <Stack direction="column" gap={2}>
          <Stack direction="column" gap={1}>
            <Stack direction="column" gap={1}>
              <Stack direction="row" alignItems="end" justifyContent="space-between" gap={1}>
                <Label htmlFor={recipientLabelId}>
                  <span id={recipientLabelId}>
                    {t('alerting.simplified.notification.recipient.label', 'Recipient')}
                  </span>
                </Label>
                <div className={styles.manualRoutingInline}>
                  <RadioButtonGroup
                    size="sm"
                    options={[
                      {
                        label: t(
                          'alerting.manual-and-automatic-routing.routing-options.label.contact-point',
                          'Contact point'
                        ),
                        value: 'contact',
                      },
                      {
                        label: t(
                          'alerting.manual-and-automatic-routing.routing-options.label.notification-policy',
                          'Notification policy'
                        ),
                        value: 'policy',
                      },
                    ]}
                    value={manualRouting ? 'contact' : 'policy'}
                    onChange={(val: 'contact' | 'policy') => {
                      const next = val === 'contact';
                      setValue('manualRouting', next, { shouldDirty: true, shouldValidate: true });
                      setValue('editorSettings.simplifiedNotificationEditor', next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    aria-label={t('alerting.simplified.notification.manual-routing.aria', 'Toggle manual routing')}
                  />
                </div>
              </Stack>
              <Text variant="bodySmall" color="secondary">
                {useNotificationPolicy ? (
                  <Trans i18nKey="alerting.simplified.notification.policy-selected">
                    Notifications for firing alerts are routed to contact points based on matching labels and the
                    notification policy tree.
                  </Trans>
                ) : (
                  <Trans i18nKey="alerting.simplified.notification.contact-point-selected">
                    Notifications for firing alerts are routed to a selected contact point.
                  </Trans>
                )}
              </Text>
            </Stack>
            {useNotificationPolicy ? (
              <div className={styles.contentTopSpacer}>
                <NeedHelpInfoForNotificationPolicy />
              </div>
            ) : (
              <div className={styles.contentTopSpacer}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Combobox<ComboboxOption<string>['value']>
                    options={options}
                    value={
                      selectedContactPoint ? (options.find((o) => o.value === selectedContactPoint) ?? null) : null
                    }
                    onChange={(opt) =>
                      setValue(CONTACT_POINT_PATH, opt?.value ?? '', {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    width={30}
                    placeholder={t(
                      'alerting.simplified.notification.select-contact-point',
                      'Select a contact point...'
                    )}
                    isClearable
                    data-testid="contact-point"
                    loading={status === 'pending'}
                  />
                  <Button
                    icon="sync"
                    variant="secondary"
                    fill="text"
                    size="sm"
                    aria-label={t('alerting.common.refresh', 'Refresh')}
                    onClick={() => {
                      if (refetch) {
                        refetch();
                      }
                    }}
                  />
                  <TextLink
                    external
                    href={'/alerting/notifications'}
                    aria-label={t(
                      'alerting.link-to-contact-points.aria-label-view-or-create-contact-points',
                      'View or create contact points'
                    )}
                  >
                    <Trans i18nKey="alerting.link-to-contact-points.view-or-create-contact-points">
                      View or create contact points
                    </Trans>
                  </TextLink>
                </Stack>
              </div>
            )}
          </Stack>

          <Field label={t('alerting.simplified.notification.summary.label', 'Summary (optional)')} noMargin>
            <TextArea
              id="summary-text-area"
              placeholder={t(
                'alerting.simplified.notification.summary.placeholder',
                'Enter a summary of what happened and why…'
              )}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.description.label', 'Description (optional)')} noMargin>
            <TextArea
              id="description-text-area"
              placeholder={t(
                'alerting.simplified.notification.description.placeholder',
                'Enter a description of what the alert rule does…'
              )}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.runbook-url.label', 'Runbook URL (optional)')} noMargin>
            <Input
              id="runbook-url-input"
              placeholder={t(
                'alerting.simplified.notification.runbook-url.placeholder',
                'Enter the webpage where you keep your runbook for the alert…'
              )}
            />
          </Field>
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({ width: '100%' }),
    sectionHeaderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      fontWeight: 600,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    stepBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      width: 20,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 600,
    }),
    contentIndented: css({ marginLeft: `calc(20px + ${theme.spacing(1)})` }),
    contentTopSpacer: css({ marginTop: theme.spacing(0.5) }),
    manualRoutingInline: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      maxWidth: '100%',
    }),
  };
}
