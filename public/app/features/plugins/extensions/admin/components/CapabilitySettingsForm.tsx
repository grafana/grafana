import { css, cx } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';

import { PluginExtensionRegistry } from '../../types';

type Props = {
  capabilityId: string;
  registry?: PluginExtensionRegistry;
};

export function CapabilitySettingsForm({ capabilityId, registry }: Props): ReactElement | null {
  const styles = useStyles2(getStyles);
  const capability = registry?.[capabilityId][0];

  return (
    <div>
      <h2 className={styles.title}>
        Capability <span className={styles.titleCode}>{capabilityId.replace('capabilities/', '')}</span>
      </h2>

      <div className={styles.extensions}>
        {!capability && (
          <div>
            <span className={styles.disabledText}>No extensions yet.</span>{' '}
            <a href="/" className={styles.link}>
              Learn how to register an extension &rarr;
            </a>
          </div>
        )}

        {capability && (
          <div className={styles.extensionRow}>
            <div className={styles.extensionRowLeft}>
              <InlineSwitch label="Enable" showLabel={true} value={true} transparent={true} />
              <Tooltip
                placement="top"
                content={'Disabling it will make this capabiltiy unavailble for any plugin that uses it'}
                theme="info"
              >
                <Icon name="info-circle" size="md" className={styles.infoIcon} />
              </Tooltip>
            </div>
            <div className={styles.extensionRowRight}>
              <div className={styles.extensionRowTitle}>{capability.config.title}</div>
              <div className={styles.extensionRowDescription}>{capability.config.description}</div>
              <pre className={styles.extensionRowCode}>{capability.config.function.toString()}</pre>
              <div className={styles.extensionRowHelp}>
                <a href="/" className={styles.link}>
                  How can I use this capability?
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    display: inline-block;
  `,
  titleCode: css`
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
    padding-left: ${theme.spacing(3)};
  `,
  extensionRowTitle: css``,
  extensionRowDescription: css`
    color: ${theme.colors.text.secondary};
  `,
  extensionRowCode: css`
    margin-top: ${theme.spacing(1)};
  `,
  extensionRowHelp: css`
    margin-top: ${theme.spacing(2)};
  `,
  marginLeft: css`
    margin-left: ${theme.spacing(1)};
  `,
  infoIcon: css`
    cursor: pointer;
    position: relative;
    top: -1px;
    left: -3px;
  `,
});
