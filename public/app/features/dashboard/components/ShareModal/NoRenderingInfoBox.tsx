import React from 'react';
import { css } from 'emotion';
import { InfoBox, Alert, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

export interface Props {
  variant?: 'info' | 'error';
}

const InfoMessage: React.FC = () => {
  return (
    <>
      <p>
        <>To be able to render an image of the panel, you must install the </>
        <a
          href="https://grafana.com/grafana/plugins/grafana-image-renderer"
          target="_blank"
          rel="noopener"
          className="external-link"
        >
          Grafana Image Renderer plugin
        </a>
        .
      </p>
    </>
  );
};

const actionMessage = 'Please contact your Grafana administrator to install the plugin.';

export const NoRenderingInfoBox: React.FC<Props> = ({ variant = 'info' }) => {
  const theme = useTheme();
  const styles = getInfoBoxStyles(theme);

  return variant === 'info' ? (
    <InfoBox className={styles.card} header="No image renderer available/installed">
      <span>
        <InfoMessage />
        <p>{actionMessage}</p>
      </span>
    </InfoBox>
  ) : (
    <div className={styles.card}>
      <Alert title="" severity="error">
        <div className={styles.message}>
          <p>
            <InfoMessage />
          </p>
          <p>{actionMessage}</p>
        </div>
      </Alert>
    </div>
  );
};

const getInfoBoxStyles = stylesFactory((theme: GrafanaTheme) => ({
  card: css`
    max-width: ${theme.breakpoints.lg};
    margin-top: ${theme.spacing.md};
    margin-bottom: ${theme.spacing.lg};
    align-self: center;
  `,
  message: css`
    margin-top: ${theme.spacing.md};
  `,
}));
