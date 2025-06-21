import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { CollapsableSection, Stack, Text, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { AlertManagerDataSource } from 'app/features/alerting/unified/utils/datasource';

import { NeedHelpInfo } from '../../NeedHelpInfo';

import { ContactPointSelector } from './contactPoint/ContactPointSelector';
import { ActiveTimingFields } from './route-settings/ActiveTimingFields';
import { MuteTimingFields } from './route-settings/MuteTimingFields';
import { RoutingSettings } from './route-settings/RouteSettings';

interface AlertManagerManualRoutingProps {
  alertManager: AlertManagerDataSource;
}

export function AlertManagerManualRouting({ alertManager }: AlertManagerManualRoutingProps) {
  const styles = useStyles2(getStyles);

  const alertManagerName = alertManager.name;

  const { watch } = useFormContext<RuleFormValues>();

  const hasRouteSettings =
    watch(`contactPoints.${alertManagerName}.overrideGrouping`) ||
    watch(`contactPoints.${alertManagerName}.overrideTimings`) ||
    watch(`contactPoints.${alertManagerName}.muteTimeIntervals`)?.length > 0;

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <div className={styles.firstAlertManagerLine} />
        <div className={styles.alertManagerName}>
          <Trans i18nKey="alerting.rule-form.simple-routing.alertmanager-label">Alertmanager:</Trans>
          <img src={alertManager.imgUrl} alt="Alert manager logo" className={styles.img} />
          {alertManagerName}
        </div>
        <div className={styles.secondAlertManagerLine} />
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <ContactPointSelector alertManager={alertManagerName} />
      </Stack>
      {/* @TODO
        we can show the contact point details here when it's selected but we currently don't have a
        way to summarize the details from the ContactPoint type in @grafana/alerting
      */}
      <div className={styles.routingSection}>
        <CollapsableSection
          label={t(
            'alerting.alert-manager-manual-routing.label-muting-grouping-and-timings-optional',
            'Muting, grouping and timings (optional)'
          )}
          isOpen={hasRouteSettings}
          className={styles.collapsableSection}
          contentClassName={styles.collapsableSectionContent}
        >
          <Stack direction="column" gap={1}>
            <Stack direction="row" gap={0.5} alignItems="center">
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.rule-form.simple-routing.optional-settings.description">
                  Configure how notifications for this alert rule are sent.
                </Trans>
              </Text>
              <NeedHelpInfo
                title={t(
                  'alerting.alert-manager-manual-routing.title-muting-grouping-and-timings',
                  'Muting, grouping, and timings'
                )}
                linkText={'Read about notification grouping'}
                externalLink={
                  'https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/group-alert-notifications/'
                }
                contentText={
                  <>
                    <p>
                      {t(
                        'alerting.rule-form.simple-routing.optional-settings.help-info1',
                        'Mute timings allows you to temporarily pause notifications for a specific recurring period, such as a regular maintenance window or weekends.'
                      )}
                    </p>
                    {t(
                      'alerting.rule-form.simple-routing.optional-settings.help-info2',
                      'Grouping and timing options combine multiple alerts within a specific period into a single notification, allowing you to customize default options.'
                    )}
                  </>
                }
              />
            </Stack>
            <MuteTimingFields alertmanager={alertManagerName} />
            <ActiveTimingFields alertmanager={alertManagerName} />
            <RoutingSettings alertManager={alertManagerName} />
          </Stack>
        </CollapsableSection>
      </div>
    </Stack>
  );
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
  collapsableSection: css({
    width: 'fit-content',
    fontSize: theme.typography.body.fontSize,
  }),
  collapsableSectionContent: css({
    padding: '0',
  }),
  routingSection: css({
    display: 'flex',
    flexDirection: 'column',
    maxWidth: theme.breakpoints.values.xl,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    marginTop: theme.spacing(2),
  }),
});
