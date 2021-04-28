import React from 'react';
import { css } from '@emotion/css';
import { Alert, HorizontalGroup, Modal, useStyles2, VerticalGroup } from '@grafana/ui';
import { GrafanaThemeV2 } from '@grafana/data';

export interface Props {
  onDismiss: () => void;
  apiKey: string;
  rootPath: string;
}

export function ApiKeysAddedModal({ onDismiss, apiKey, rootPath }: Props): JSX.Element {
  const styles = useStyles2(getStyles);
  return (
    <Modal title="API Key Created" onDismiss={onDismiss} onClickBackdrop={onDismiss} isOpen>
      <VerticalGroup spacing="md">
        <HorizontalGroup spacing="sm">
          <span className={styles.label}>Key</span>
          <span className={styles.label}>{apiKey}</span>
        </HorizontalGroup>

        <Alert
          title="You will only be able to view this key here once! It is not stored in this form, so be sure to copy it now."
          severity="info"
        >
          <p>You can authenticate a request using the Authorization HTTP header, example:</p>
          <pre className={styles.small}>
            curl -H &quot;Authorization: Bearer {apiKey}&quot; {rootPath}/api/dashboards/home
          </pre>
        </Alert>
      </VerticalGroup>
    </Modal>
  );
}

function getStyles(theme: GrafanaThemeV2) {
  return {
    label: css`
      padding: ${theme.spacing(1)};
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
    `,
    small: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
    `,
  };
}
