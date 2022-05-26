import { css } from '@emotion/css';
import React from 'react';

import { config } from '@grafana/runtime/src';
import { Alert, useStyles2 } from '@grafana/ui';

export interface Props {
  showPreviews?: boolean;
  /** On click handler for alert button, mostly used for dismissing the alert */
  onRemove?: (event: React.MouseEvent) => void;
  topSpacing?: number;
  bottomSpacing?: number;
}

const MessageLink = ({ text }: { text: string }) => (
  <a
    href="https://grafana.com/grafana/plugins/grafana-image-renderer"
    target="_blank"
    rel="noopener noreferrer"
    className="external-link"
  >
    {text}
  </a>
);

const Message = ({ requiredImageRendererPluginVersion }: { requiredImageRendererPluginVersion?: string }) => {
  if (requiredImageRendererPluginVersion) {
    return (
      <>
        You must update the <MessageLink text="Grafana image renderer plugin" /> to version{' '}
        {requiredImageRendererPluginVersion} to enable dashboard previews. Please contact your Grafana administrator to
        update the plugin.
      </>
    );
  }

  return (
    <>
      You must install the <MessageLink text="Grafana image renderer plugin" /> to enable dashboard previews. Please
      contact your Grafana administrator to install the plugin.
    </>
  );
};

export const PreviewsSystemRequirements = ({ showPreviews, onRemove, topSpacing, bottomSpacing }: Props) => {
  const styles = useStyles2(getStyles);

  const previewsEnabled = config.featureToggles.dashboardPreviews;
  const rendererAvailable = config.rendererAvailable;

  const {
    systemRequirements: { met: systemRequirementsMet, requiredImageRendererPluginVersion },
    thumbnailsExist,
  } = config.dashboardPreviews;

  const arePreviewsEnabled = previewsEnabled && showPreviews;
  const areRequirementsMet = (rendererAvailable && systemRequirementsMet) || thumbnailsExist;
  const shouldDisplayRequirements = arePreviewsEnabled && !areRequirementsMet;

  const title = requiredImageRendererPluginVersion
    ? 'Image renderer plugin needs to be updated'
    : 'Image renderer plugin not installed';

  return (
    <>
      {shouldDisplayRequirements && (
        <div className={styles.wrapper}>
          <Alert
            className={styles.alert}
            topSpacing={topSpacing}
            bottomSpacing={bottomSpacing}
            severity="info"
            title={title}
            onRemove={onRemove}
          >
            <Message requiredImageRendererPluginVersion={requiredImageRendererPluginVersion} />
          </Alert>
        </div>
      )}
    </>
  );
};

const getStyles = () => {
  return {
    wrapper: css`
      display: flex;
      justify-content: center;
    `,
    alert: css`
      max-width: 800px;
    `,
  };
};
