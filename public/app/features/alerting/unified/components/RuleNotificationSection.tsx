import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';
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
import { useAppNotification } from 'app/core/copy/appNotification';

import { RuleFormValues } from '../types/rule-form';
import { Annotation } from '../utils/constants';

import { NeedHelpInfoForNotificationPolicy } from './rule-editor/NotificationsStep';

// Centralized form path for selected contact point
const CONTACT_POINT_PATH = 'contactPoints.grafana.selectedContactPoint' as const;

export function RuleNotificationSection() {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();

  const { watch, setValue } = useFormContext<RuleFormValues>();
  const manualRouting = watch('manualRouting');
  const useNotificationPolicy = !manualRouting;
  const selectedContactPoint = watch(CONTACT_POINT_PATH);
  const annotations = watch('annotations');

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

  // Helper functions to get and set annotation values
  const getAnnotationValue = useCallback(
    (key: string) => {
      return annotations.find((a) => a.key === key)?.value ?? '';
    },
    [annotations]
  );

  const updateAnnotationValue = useCallback(
    (key: string, value: string) => {
      const updatedAnnotations = [...annotations];
      const index = updatedAnnotations.findIndex((a) => a.key === key);

      if (index >= 0) {
        updatedAnnotations[index] = { key, value };
      } else {
        updatedAnnotations.push({ key, value });
      }

      setValue('annotations', updatedAnnotations, { shouldDirty: true, shouldValidate: true });
    },
    [annotations, setValue]
  );

  const summaryValue = getAnnotationValue(Annotation.summary);
  const descriptionValue = getAnnotationValue(Annotation.description);
  const runbookUrlValue = getAnnotationValue(Annotation.runbookURL);

  const recipientLabelId = 'recipient-label';

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionHeader}>
          {`3. `}
          <Trans i18nKey="alerting.simplified.notification.title">Notification</Trans>
        </div>
      </div>

      <div>
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
                    onClick={async () => {
                      try {
                        await refetch();
                      } catch (error) {
                        notifyApp.error(
                          t('alerting.simplified.notification.refresh-error', 'Failed to refresh contact points')
                        );
                      }
                    }}
                  />
                  <TextLink
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
              value={summaryValue}
              onChange={(e) => updateAnnotationValue(Annotation.summary, e.currentTarget.value)}
              placeholder={t(
                'alerting.simplified.notification.summary.placeholder',
                'Enter a summary of what happened and why…'
              )}
              aria-label={t('alerting.simplified.notification.summary.aria-label', 'Summary')}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.description.label', 'Description (optional)')} noMargin>
            <TextArea
              id="description-text-area"
              value={descriptionValue}
              onChange={(e) => updateAnnotationValue(Annotation.description, e.currentTarget.value)}
              placeholder={t(
                'alerting.simplified.notification.description.placeholder',
                'Enter a description of what the alert rule does…'
              )}
              aria-label={t('alerting.simplified.notification.description.aria-label', 'Description')}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.runbook-url.label', 'Runbook URL (optional)')} noMargin>
            <Input
              id="runbook-url-input"
              type="url"
              value={runbookUrlValue}
              onChange={(e) => {
                const value = e.currentTarget.value;
                updateAnnotationValue(Annotation.runbookURL, value);
              }}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                // Validate URL on blur
                if (value && value !== '') {
                  try {
                    const url = new URL(value);
                    // Reject dangerous URL schemes
                    if (url.protocol === 'javascript:' || url.protocol === 'data:' || url.protocol === 'vbscript:') {
                      notifyApp.error(
                        t(
                          'alerting.simplified.notification.runbook-url.invalid-protocol',
                          'Invalid URL protocol. Please use http or https.'
                        )
                      );
                    }
                  } catch {
                    notifyApp.warning(
                      t(
                        'alerting.simplified.notification.runbook-url.invalid-format',
                        'Invalid URL format. Please enter a valid URL.'
                      )
                    );
                  }
                }
              }}
              placeholder={t(
                'alerting.simplified.notification.runbook-url.placeholder',
                'Enter the webpage where you keep your runbook for the alert…'
              )}
              aria-label={t('alerting.simplified.notification.runbook-url.aria-label', 'Runbook URL')}
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
      fontWeight: theme.typography.fontWeightRegular,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
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
