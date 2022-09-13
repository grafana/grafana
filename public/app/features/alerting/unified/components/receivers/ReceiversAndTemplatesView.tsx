import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';

import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

export const ReceiversAndTemplatesView: FC<Props> = ({ config, alertManagerName }) => {
  const isCloud = alertManagerName !== GRAFANA_RULES_SOURCE_NAME;
  const styles = useStyles2(getStyles);
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
  return (
    <>
      {!isVanillaAM && <TemplatesTable config={config} alertManagerName={alertManagerName} />}
      <ReceiversTable config={config} alertManagerName={alertManagerName} />
      {isCloud && (
        <Authorize actions={[AccessControlAction.AlertingNotificationsExternalWrite]}>
          <Alert className={styles.section} severity="info" title="Global config for contact points">
            <p>
              For each external Alertmanager you can define global settings, like server addresses, usernames and
              password, for all the supported contact points.
            </p>
            <LinkButton href={makeAMLink('alerting/notifications/global-config', alertManagerName)} variant="secondary">
              {isVanillaAM ? 'View global config' : 'Edit global config'}
            </LinkButton>
          </Alert>
        </Authorize>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  section: css`
    margin-top: ${theme.spacing(4)};
  `,
});
