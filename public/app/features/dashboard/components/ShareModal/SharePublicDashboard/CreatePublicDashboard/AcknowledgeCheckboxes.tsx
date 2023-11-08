import { css } from '@emotion/css';
import React from 'react';
import { UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, useStyles2, VerticalGroup } from '@grafana/ui/src';
import { t, Trans } from 'app/core/internationalization';

import { SharePublicDashboardAcknowledgmentInputs } from './CreatePublicDashboard';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const AcknowledgeCheckboxes = ({
  disabled,
  register,
}: {
  disabled: boolean;
  register: UseFormRegister<SharePublicDashboardAcknowledgmentInputs>;
}) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <p className={styles.title}>
        <Trans i18nKey="share-modal.public-dashboard.ack-title">
          Before you make the dashboard public, acknowledge the following:
        </Trans>
      </p>
      <FieldSet disabled={disabled}>
        <VerticalGroup spacing="md">
          <HorizontalGroup key="publicAcknowledgment" spacing="none" align="center">
            <Checkbox
              {...register('publicAcknowledgment', { required: true })}
              label={t('share-modal.public-dashboard.public-ack-desc', 'Your entire dashboard will be public*')}
              data-testid={selectors.WillBePublicCheckbox}
            />
            <LinkButton
              variant="primary"
              href="https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip={t('share-modal.public-dashboard.public-ack-tooltip', 'Learn more about public dashboards')}
            />
          </HorizontalGroup>
          <HorizontalGroup key="dataSourcesAcknowledgment" spacing="none" align="center">
            <Checkbox
              {...register('dataSourcesAcknowledgment', { required: true })}
              label={t(
                'share-modal.public-dashboard.data-src-ack-desc',
                'Publishing currently only works with a subset of data sources*'
              )}
              data-testid={selectors.LimitedDSCheckbox}
            />
            <LinkButton
              variant="primary"
              href="https://grafana.com/docs/grafana/latest/datasources/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip={t('share-modal.public-dashboard.data-src-ack-tooltip', 'Learn more about public datasources')}
            />
          </HorizontalGroup>
          <HorizontalGroup key="usageAcknowledgment" spacing="none" align="center">
            <Checkbox
              {...register('usageAcknowledgment', { required: true })}
              label="https://grafana.com/docs/grafana/latest/datasources/"
              data-testid={selectors.CostIncreaseCheckbox}
            />
            <LinkButton
              variant="primary"
              href="'https://grafana.com/docs/grafana/latest/enterprise/query-caching/"
              target="_blank"
              fill="text"
              icon="info-circle"
              rel="noopener noreferrer"
              tooltip={t('share-modal.public-dashboard.usage-ack-tooltip', 'Learn more about query caching')}
            />
          </HorizontalGroup>
        </VerticalGroup>
      </FieldSet>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
