import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';
import { useObservable } from 'react-use';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { useStyles2, TabsBar, TabContent, Tab, Counter } from '@grafana/ui';
import { reactivePluginExtensionRegistry } from 'app/features/plugins/extensions/reactivePluginExtensionRegistry';

export default function ExtensionSettings(): ReactElement | null {
  const styles = useStyles2(getStyles);
  const registry = useObservable(reactivePluginExtensionRegistry.asObservable());

  return (
    <div className={styles.container}>
      {/* Left column */}
      <div className={styles.leftColumn}>
        {/* Extension points */}
        <div className={styles.leftColumnGroup}>
          <div className={styles.leftColumnGroupTitle}>Extension points</div>
          <div className={styles.leftColumnGroupSubTitle}>Core</div>
          <div className={styles.leftColumnGroupContent}>
            <div className={styles.leftColumnGroupItem}>
              Extension point 1 <Counter value={3} />
            </div>
            <div className={styles.leftColumnGroupItem}>Extension point 1</div>
            <div className={styles.leftColumnGroupItem}>
              Extension point 1 <Counter value={2} />
            </div>
          </div>

          <div className={styles.leftColumnGroupSubTitle}>Plugin 2</div>
          <div className={styles.leftColumnGroupContent}>
            <div className={styles.leftColumnGroupItem}>Extension point 1</div>
            <div className={styles.leftColumnGroupItem}>
              Extension point 1 <Counter value={2} />
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className={styles.leftColumnGroup}>
          <div className={styles.leftColumnGroupTitle}>Capabilities</div>
          <div className={styles.leftColumnGroupSubTitle}>Grafana ML App</div>
          <div className={styles.leftColumnGroupContent}>
            <div className={styles.leftColumnGroupItem}>predict()</div>
            <div className={styles.leftColumnGroupItem}>predictWeek()</div>
          </div>
        </div>
      </div>
      {/* Right column */}
      <div className={styles.rightColumn}>Right Column (Flexible width)</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    min-height: 400px;
  `,
  leftColumn: css`
    width: 300px;
    padding: ${theme.spacing(2)};
    background-color: ${theme.colors.background.secondary};
  `,
  leftColumnGroup: css`
    border-top: 2px solid ${theme.colors.border.weak};
    margin-top: ${theme.spacing(2)};
    padding-top: ${theme.spacing(2)};

    &:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
  `,
  leftColumnGroupTitle: css`
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.primary};
  `,
  leftColumnGroupSubTitle: css`
    &:not(:first-child) {
      margin-top: ${theme.spacing(2)};
    }

    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.secondary};
    padding-left: ${theme.spacing(2)};
  `,
  leftColumnGroupItem: css`
    color: ${theme.colors.text.secondary};
    padding-left: ${theme.spacing(4)};
  `,
  leftColumnGroupContent: css``,
  rightColumn: css`
    flex-grow: 1;
    padding: ${theme.spacing(2)};
  `,
});
