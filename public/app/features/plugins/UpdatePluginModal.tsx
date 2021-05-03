import React from 'react';
import { Modal, useStyles2, VerticalGroup } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export interface UpdatePluginModalProps {
  onDismiss: () => void;
  id: string;
  name: string;
}

export function UpdatePluginModal({ onDismiss, id, name }: UpdatePluginModalProps): JSX.Element {
  const styles = useStyles2(getStyles);
  return (
    <Modal title="Update Plugin" onDismiss={onDismiss} onClickBackdrop={onDismiss} isOpen>
      <VerticalGroup spacing="md">
        <VerticalGroup spacing="sm">
          <p>Type the following on the command line to update {name}.</p>
          <pre>
            <code>grafana-cli plugins update {id}</code>
          </pre>
          <span className={styles.small}>
            Check out {name} on <a href={`https://grafana.com/plugins/${id}`}>Grafana.com</a> for README and changelog.
            If you do not have access to the command line, ask your Grafana administator.
          </span>
        </VerticalGroup>
        <p className={styles.weak}>
          <img className={styles.logo} src="public/img/grafana_icon.svg" alt="grafana logo" />
          <strong>Pro tip</strong>: To update all plugins at once, type{' '}
          <code className={styles.codeSmall}>grafana-cli plugins update-all</code> on the command line.
        </p>
      </VerticalGroup>
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    small: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
    `,
    weak: css`
      color: ${theme.colors.text.disabled};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    logo: css`
      vertical-align: sub;
      margin-right: ${theme.spacing(0.3)};
      width: ${theme.spacing(2)};
    `,
    codeSmall: css`
      white-space: nowrap;
      margin: 0 ${theme.spacing(0.25)};
      padding: ${theme.spacing(0.25)};
    `,
  };
}
