import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { notificationsAPIv0alpha1 } from '@grafana/alerting/unstable';
import type { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, ComboboxOption, Field, Input, Stack, TextArea, useStyles2 } from '@grafana/ui';

import { LinkToContactPoints } from './rule-editor/alert-rule-form/simplifiedRouting/contactPoint/ContactPointSelector';

export function RuleNotificationSection() {
  const styles = useStyles2(getStyles);

  const [contactPoint, setContactPoint] = useState<ComboboxOption<string> | null>(null);
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
          <Field
            label={t('alerting.simplified.notification.contact-point', 'Contact point')}
            description={t(
              'alerting.simplified.notification.contact-point.description',
              'Select who should receive a notification when the alert rule fires'
            )}
            noMargin
          >
            <Stack direction="row" gap={1} alignItems="center">
              <Combobox<ComboboxOption<string>['value']>
                options={options}
                value={contactPoint}
                onChange={(opt) => setContactPoint(opt)}
                width={30}
                placeholder={t('alerting.simplified.notification.select-contact-point', 'Select a contact point...')}
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
              <LinkToContactPoints />
            </Stack>
          </Field>

          <Field label={t('alerting.simplified.notification.summary', 'Summary (optional)')} noMargin>
            <TextArea
              placeholder={t(
                'alerting.simplified.notification.summary.placeholder',
                'Enter a summary of what happened and why…'
              )}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.description', 'Description (optional)')} noMargin>
            <TextArea
              placeholder={t(
                'alerting.simplified.notification.description.placeholder',
                'Enter a description of what the alert rule does…'
              )}
            />
          </Field>

          <Field label={t('alerting.simplified.notification.runbook-url', 'Runbook URL (optional)')} noMargin>
            <Input
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
  };
}
