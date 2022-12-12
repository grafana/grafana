import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, CallToActionCard, Card, Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';

import { ExternalDataSourceAM } from '../../hooks/useExternalAmSelector';
import { makeDataSourceLink } from '../../utils/misc';

export interface ExternalAlertManagerDataSourcesProps {
  alertmanagers: ExternalDataSourceAM[];
  inactive: boolean;
}

export function ExternalAlertmanagerDataSources({ alertmanagers, inactive }: ExternalAlertManagerDataSourcesProps) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h5>Alertmanagers Receiving Grafana-managed alerts</h5>
      <div className={styles.muted}>
        Alertmanager data sources support a configuration setting that allows you to choose to send Grafana-managed
        alerts to that Alertmanager. <br />
        Below, you can see the list of all Alertmanager data sources that have this setting enabled.
      </div>
      {alertmanagers.length === 0 && (
        <CallToActionCard
          message={
            <div>
              There are no Alertmanager data sources configured to receive Grafana-managed alerts. <br />
              You can change this by selecting Receive Grafana Alerts in a data source configuration.
            </div>
          }
          callToActionElement={<LinkButton href="/datasources">Go to data sources</LinkButton>}
          className={styles.externalDsCTA}
        />
      )}
      {alertmanagers.length > 0 && (
        <div className={styles.externalDs}>
          {alertmanagers.map((am) => (
            <ExternalAMdataSourceCard key={am.dataSource.uid} alertmanager={am} inactive={inactive} />
          ))}
        </div>
      )}
    </>
  );
}

interface ExternalAMdataSourceCardProps {
  alertmanager: ExternalDataSourceAM;
  inactive: boolean;
}

export function ExternalAMdataSourceCard({ alertmanager, inactive }: ExternalAMdataSourceCardProps) {
  const styles = useStyles2(getStyles);

  const { dataSource, status, statusInconclusive, url } = alertmanager;

  return (
    <Card>
      <Card.Heading className={styles.externalHeading}>
        {dataSource.name}{' '}
        {statusInconclusive && (
          <Tooltip content="Multiple Alertmangers have the same URL configured. The state might be inconclusive.">
            <Icon name="exclamation-triangle" size="md" className={styles.externalWarningIcon} />
          </Tooltip>
        )}
      </Card.Heading>
      <Card.Figure>
        <img
          src="public/app/plugins/datasource/alertmanager/img/logo.svg"
          alt=""
          height="40px"
          width="40px"
          style={{ objectFit: 'contain' }}
        />
      </Card.Figure>
      <Card.Tags>
        {inactive ? (
          <Badge
            text="Inactive"
            color="red"
            tooltip="Grafana is configured to send alerts to the built-in internal Alertmanager only. External Alertmanagers do not receive any alerts."
          />
        ) : (
          <Badge
            text={capitalize(status)}
            color={status === 'dropped' ? 'red' : status === 'active' ? 'green' : 'orange'}
          />
        )}
      </Card.Tags>
      <Card.Meta>{url}</Card.Meta>
      <Card.Actions>
        <LinkButton href={makeDataSourceLink(dataSource)} size="sm" variant="secondary">
          Go to datasource
        </LinkButton>
      </Card.Actions>
    </Card>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  muted: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.typography.bodySmall.lineHeight};
    color: ${theme.colors.text.secondary};
  `,
  externalHeading: css`
    justify-content: flex-start;
  `,
  externalWarningIcon: css`
    margin: ${theme.spacing(0, 1)};
    fill: ${theme.colors.warning.main};
  `,
  externalDs: css`
    display: grid;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(2, 0)};
  `,
  externalDsCTA: css`
    margin: ${theme.spacing(2, 0)};
  `,
});
