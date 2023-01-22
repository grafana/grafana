import { css } from '@emotion/css';
import React from 'react';
import { UseFormRegister } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Checkbox, FieldSet, HorizontalGroup, LinkButton, useStyles2, VerticalGroup } from '@grafana/ui/src';
import { Align } from '@grafana/ui/src/components/Layout/Layout';

import { SharePublicDashboardAcknowledgmentInputs, SharePublicDashboardInputs } from './SharePublicDashboard';

type Acknowledge = {
  type: keyof SharePublicDashboardAcknowledgmentInputs;
  description: string;
  testId: string;
  align?: Align;
  info: {
    href: string;
    tooltip: string;
  };
};
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

const ACKNOWLEDGES: Acknowledge[] = [
  {
    type: 'publicAcknowledgment',
    description: 'Your entire dashboard will be public',
    testId: selectors.WillBePublicCheckbox,
    info: {
      href: 'https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/',
      tooltip: 'Learn more about public dashboards',
    },
  },
  {
    type: 'dataSourcesAcknowledgment',
    description: 'Publishing currently only works with a subset of datasources',
    testId: selectors.LimitedDSCheckbox,
    info: {
      href: 'https://grafana.com/docs/grafana/latest/datasources/',
      tooltip: 'Learn more about public datasources',
    },
  },
  {
    type: 'usageAcknowledgment',
    description:
      'Making your dashboard public will cause queries to run each time the dashboard is viewed which may increase costs',
    testId: selectors.CostIncreaseCheckbox,
    align: 'flex-start',
    info: {
      href: 'https://grafana.com/docs/grafana/latest/enterprise/query-caching/',
      tooltip: 'Learn more about query caching',
    },
  },
];

export const AcknowledgeCheckboxes = ({
  disabled,
  register,
}: {
  disabled: boolean;
  register: UseFormRegister<SharePublicDashboardInputs>;
}) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <p>Before you click Save, please acknowledge the following information:</p>
      <FieldSet disabled={disabled}>
        <VerticalGroup spacing="md">
          {ACKNOWLEDGES.map((acknowledge) => (
            <HorizontalGroup key={acknowledge.type} spacing="none" align={acknowledge.align || 'flex-end'}>
              <Checkbox
                {...register(acknowledge.type)}
                label={acknowledge.description}
                data-testid={acknowledge.testId}
                className={styles.checkbox}
                labelClassName={styles.checkboxLabel}
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
            </HorizontalGroup>
          ))}
        </VerticalGroup>
      </FieldSet>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  checkbox: css`
    display: flex;
    align-items: baseline;
  `,
  checkboxLabel: css`
    white-space: break-spaces;
    max-width: fit-content;
    line-height: ${theme.typography.bodySmall.lineHeight};
  `,
});
