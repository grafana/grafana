import { css, cx } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, InlineSwitch, useStyles2 } from '@grafana/ui';

import { PluginExtensionRegistry } from '../../types';

type Props = {
  extensionPointId: string;
  registry?: PluginExtensionRegistry;
};

export function ExtensionSettingsForm({ extensionPointId, registry }: Props): ReactElement | null {
  const styles = useStyles2(getStyles);

  const extensionPoint = registry?.[extensionPointId];
  return (
    <div>
      <h2 className={styles.title}>{extensionPointId}</h2>

      <div className={styles.extensions}>
        <h4>Registered extensions</h4>

        {!extensionPoint && (
          <div>
            <span className={styles.disabledText}>No extensions yet.</span>{' '}
            <a href="/" className={styles.link}>
              Learn how to register an extension &rarr;
            </a>
          </div>
        )}

        {extensionPoint?.map((extension, index) => (
          <div key={index} className={styles.extensionRow}>
            <div className={styles.extensionRowLeft}>
              <InlineSwitch label="Enable" showLabel={true} value={true} transparent={true} />
            </div>
            <div className={styles.extensionRowRight}>
              <div className={styles.extensionRowTitle}>
                {extension.config.title}
                {extension.pluginId === 'grafana' && <Badge color="green" text="core" className={styles.marginLeft} />}
                {extension.pluginId !== 'grafana' && (
                  <Badge color="orange" text={extension.pluginId} className={styles.marginLeft} />
                )}
              </div>
              <div className={styles.extensionRowDescription}>{extension.config.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    display: inline-block;
    background-color: ${theme.colors.background.canvas};
    border-radius: 3px;
    padding: ${theme.spacing(0.5)} ${theme.spacing(2)};
    border: 1px solid ${theme.colors.border.medium};
  `,
  extensions: css`
    margin-top: ${theme.spacing(3)};
  `,
  disabledText: css`
    color: ${theme.colors.text.disabled};
  `,
  link: css`
    color: ${theme.colors.text.link};
    text-decoration: underline;
    font-size: ${theme.typography.pxToRem(12)};
  `,
  extensionRow: css`
    display: flex;
    background-color: ${theme.colors.background.secondary};
    margin-bottom: ${theme.spacing(2)};
    padding: ${theme.spacing(2)};
  `,
  extensionRowLeft: css``,
  extensionRowRight: css`
    flex-grow: 1;
    padding-left: ${theme.spacing(2)};
  `,
  extensionRowTitle: css``,
  extensionRowDescription: css`
    color: ${theme.colors.text.secondary};
  `,
  marginLeft: css`
    margin-left: ${theme.spacing(1)};
  `,
});
