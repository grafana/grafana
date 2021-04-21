import React from 'react';
import { Modal, stylesFactory, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  pluginName: string;
  pluginID: string;
  onConfirm?: () => void;
  onDismiss?: () => void;
}

export function UpdatePluginModal({ pluginName, pluginID, onDismiss }: Props) {
  const styles = useStyles(getStyles);

  return (
    <Modal title="Update Plugin" icon="cloud-download" onDismiss={onDismiss} isOpen>
      <div className={styles.container}>
        <p>Type the following on the command line to update {pluginName}.</p>
        <pre>
          <code>grafana-cli plugins update {pluginID}</code>
        </pre>
        <span className={styles.small}>
          Check out {pluginName} on <a href={`https://grafana.com/plugins/${pluginID}`}>Grafana.com</a> for README and
          changelog. If you do not have access to the command line, ask your Grafana administator.
        </span>
      </div>
      <p className={styles.updateAllTip}>
        <img className={styles.inlineLogo} src="public/img/grafana_icon.svg" />
        <strong>Pro tip</strong>: To update all plugins at once, type{' '}
        <code className={styles.codeSmall}>grafana-cli plugins update-all</code> on the command line.
      </p>
    </Modal>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  small: css`
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.weight.regular};
  `,
  codeSmall: css`
    font-size: ${theme.typography.size.xs};
    padding: ${theme.spacing.xxs};
    margin: 0 ${theme.spacing.xxs};
  `,
  container: css`
    margin-bottom: calc(${theme.spacing.d} * 2.5);
  `,
  updateAllTip: css`
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.sm};
  `,
  inlineLogo: css`
    vertical-align: sub;
    margin-right: calc(${theme.spacing.d} / 3);
    width: ${theme.spacing.md};
  `,
}));
