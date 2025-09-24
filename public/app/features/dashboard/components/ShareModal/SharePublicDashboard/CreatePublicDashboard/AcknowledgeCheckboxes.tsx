import { css } from '@emotion/css';
import { UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Trans, t } from '@grafana/i18n';
import { Checkbox, FieldSet, LinkButton, useStyles2, Stack } from '@grafana/ui';

import { SharePublicDashboardAcknowledgmentInputs } from './CreatePublicDashboard';

type Acknowledge = {
  type: keyof SharePublicDashboardAcknowledgmentInputs;
  description: string;
  testId: string;
  info: {
    href: string;
    tooltip: string;
  };
};
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const AcknowledgeCheckboxes = ({
  disabled,
  register,
}: {
  disabled: boolean;
  register: UseFormRegister<SharePublicDashboardAcknowledgmentInputs>;
}) => {
  const styles = useStyles2(getStyles);

  const ACKNOWLEDGES: Acknowledge[] = [
    {
      type: 'publicAcknowledgment',
      description: t(
        'public-dashboard.acknowledgment-checkboxes.public-ack-desc',
        'Your entire dashboard will be public*'
      ),
      testId: selectors.WillBePublicCheckbox,
      info: {
        href: 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/',
        tooltip: t(
          'public-dashboard.acknowledgment-checkboxes.public-ack-tooltip',
          'Learn more about public dashboards'
        ),
      },
    },
    {
      type: 'dataSourcesAcknowledgment',
      description: t(
        'public-dashboard.acknowledgment-checkboxes.data-src-ack-desc',
        'Publishing currently only works with a subset of data sources*'
      ),
      testId: selectors.LimitedDSCheckbox,
      info: {
        href: 'https://grafana.com/docs/grafana/latest/datasources/',
        tooltip: t(
          'public-dashboard.acknowledgment-checkboxes.data-src-ack-tooltip',
          'Learn more about public datasources'
        ),
      },
    },
    {
      type: 'usageAcknowledgment',
      description: t(
        'public-dashboard.acknowledgment-checkboxes.usage-ack-desc',
        'Making a dashboard public will cause queries to run each time it is viewed, which may increase costs*'
      ),
      testId: selectors.CostIncreaseCheckbox,
      info: {
        href: 'https://grafana.com/docs/grafana/latest/enterprise/query-caching/',
        tooltip: t(
          'public-dashboard.acknowledgment-checkboxes.usage-ack-desc-tooltip',
          'Learn more about query caching'
        ),
      },
    },
  ];

  return (
    <>
      <p className={styles.title}>
        <Trans i18nKey="public-dashboard.acknowledgment-checkboxes.ack-title">
          Before you make the dashboard public, acknowledge the following:
        </Trans>
      </p>
      <FieldSet disabled={disabled}>
        <Stack direction="column" gap={2}>
          {ACKNOWLEDGES.map((acknowledge) => (
            <Stack key={acknowledge.type} gap={0} alignItems="center">
              <Checkbox
                {...register(acknowledge.type, { required: true })}
                label={acknowledge.description}
                data-testid={acknowledge.testId}
              />
              <LinkButton
                variant="primary"
                href={acknowledge.info.href}
                target="_blank"
                fill="text"
                icon="info-circle"
                rel="noopener noreferrer"
                tooltip={acknowledge.info.tooltip}
              />
            </Stack>
          ))}
        </Stack>
      </FieldSet>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css({
    fontWeight: theme.typography.fontWeightBold,
  }),
});
