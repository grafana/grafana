import { DataSourceSettings, GrafanaTheme } from '@grafana/data';
import { DismissableFeatureInfoBox, useStyles } from '@grafana/ui';
import { css } from 'emotion';
import React, { FC } from 'react';
import { config } from 'app/core/config';
import { GrafanaEdition } from '@grafana/data/src/types/config';

export interface Props {
  dataSource: DataSourceSettings;
}

export const CloudInfoBox: FC<Props> = ({ dataSource }) => {
  const styles = useStyles(getStyles);
  let mainDS = '';
  let extraDS = '';

  // don't show for already configured data sources or provisioned data sources
  if (dataSource.readOnly || (dataSource.version ?? 0) > 2) {
    return null;
  }

  // Skip showing this info box in some editions
  if (config.buildInfo.edition !== GrafanaEdition.OpenSource) {
    return null;
  }

  switch (dataSource.type) {
    case 'prometheus':
      mainDS = 'Prometheus';
      extraDS = 'Loki';
      break;
    case 'loki':
      mainDS = 'Loki';
      extraDS = 'Prometheus';
      break;
    default:
      return null;
  }

  return (
    <DismissableFeatureInfoBox
      title={`Configure your ${mainDS} data source below`}
      persistenceId="data-source-settings-cloud-info-box"
      className={styles.box}
      branded={false}
    >
      <div className={styles.text}>
        Or skip the effort and get {mainDS} (and {extraDS}) as fully managed, scalable and hosted data sources from
        Grafana Labs with the{' '}
        <a
          className="external-link"
          href={`https://grafana.com/signup/cloud/connect-account?src=grafana-oss&cnt=${dataSource.type}-settings`}
          target="_blank"
          rel="noreferrer"
          title="The free plan includes 10k active metrics and 50gb storage."
        >
          free-forever Grafana Cloud plan
        </a>
        .
      </div>
    </DismissableFeatureInfoBox>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    box: css`
      margin: 0 0 ${theme.spacing.lg} 0;
    `,
    text: css`
      color: ${theme.colors.textSemiWeak};
      padding: ${theme.spacing.sm} 0;
      a {
        text-decoration: underline;
      }
    `,
  };
};
