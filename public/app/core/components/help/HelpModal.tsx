import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';
import { t } from 'app/core/internationalization';

const getShortcuts = (modKey: string) => {
  return [
    {
      category: t('help-modal.shortcuts-category.global', 'Global'),
      shortcuts: [
        {
          keys: ['g', 'h'],
          description: t('help-modal.shortcuts-description.go-to-home-dashboard', 'Go to Home Dashboard'),
        },
        {
          keys: ['g', 'd'],
          description: t('help-modal.shortcuts-description.go-to-dashboards', 'Go to Dashboards'),
        },
        { keys: ['g', 'e'], description: t('help-modal.shortcuts-description.go-to-explore', 'Go to Explore') },
        { keys: ['g', 'p'], description: t('help-modal.shortcuts-description.go-to-profile', 'Go to Profile') },
        { keys: [`${modKey} + k`], description: t('help-modal.shortcuts-description.open-search', 'Open search') },
        {
          keys: ['esc'],
          description: t('help-modal.shortcuts-description.exit-edit/setting-views', 'Exit edit/setting views'),
        },
        {
          keys: ['h'],
          description: t('help-modal.shortcuts-description.show-all-shortcuts', 'Show all keyboard shortcuts'),
        },
        { keys: ['c', 't'], description: t('help-modal.shortcuts-description.change-theme', 'Change theme') },
      ],
    },
    {
      category: t('help-modal.shortcuts-category.dashboard', 'Dashboard'),
      shortcuts: [
        { keys: [`${modKey}+s`], description: t('help-modal.shortcuts-description.save-dashboard', 'Save dashboard') },
        {
          keys: ['d', 'r'],
          description: t('help-modal.shortcuts-description.refresh-all-panels', 'Refresh all panels'),
        },
        {
          keys: ['d', 's'],
          description: t('help-modal.shortcuts-description.dashboard-settings', 'Dashboard settings'),
        },
        {
          keys: ['d', 'v'],
          description: t('help-modal.shortcuts-description.toggle-active-mode', 'Toggle in-active / view mode'),
        },
        {
          keys: ['d', 'k'],
          description: t('help-modal.shortcuts-description.toggle-kiosk', 'Toggle kiosk mode (hides top nav)'),
        },
        { keys: ['d', 'E'], description: t('help-modal.shortcuts-description.expand-all-rows', 'Expand all rows') },
        { keys: ['d', 'C'], description: t('help-modal.shortcuts-description.collapse-all-rows', 'Collapse all rows') },
        {
          keys: ['d', 'a'],
          description: t(
            'help-modal.shortcuts-description.toggle-auto-fit',
            'Toggle auto fit panels (experimental feature)'
          ),
        },
        {
          keys: [`${modKey} + o`],
          description: t('help-modal.shortcuts-description.toggle-graph-crosshair', 'Toggle shared graph crosshair'),
        },
        {
          keys: ['d', 'l'],
          description: t('help-modal.shortcuts-description.toggle-all-panel-legends', 'Toggle all panel legends'),
        },
        {
          keys: ['d', 'x'],
          description: t('help-modal.shortcuts-description.toggle-exemplars', 'Toggle exemplars in all panel'),
        },
      ],
    },
    {
      category: t('help-modal.shortcuts-category.focused-panel', 'Focused Panel'),
      shortcuts: [
        {
          keys: ['e'],
          description: t('help-modal.shortcuts-description.toggle-panel-edit', 'Toggle panel edit view'),
        },
        {
          keys: ['v'],
          description: t('help-modal.shortcuts-description.toggle-panel-fullscreen', 'Toggle panel fullscreen view'),
        },
        {
          keys: ['p', 's'],
          description: t('help-modal.shortcuts-description.open-shared-modal', 'Open Panel Share Modal'),
        },
        { keys: ['p', 'd'], description: t('help-modal.shortcuts-description.duplicate-panel', 'Duplicate Panel') },
        { keys: ['p', 'r'], description: t('help-modal.shortcuts-description.remove-panel', 'Remove Panel') },
        {
          keys: ['p', 'l'],
          description: t('help-modal.shortcuts-description.toggle-panel-legend', 'Toggle panel legend'),
        },
      ],
    },
    {
      category: t('help-modal.shortcuts-category.time-range', 'Time Range'),
      shortcuts: [
        {
          keys: ['t', 'z'],
          description: t('help-modal.shortcuts-description.zoom-out-time-range', 'Zoom out time range'),
        },
        {
          keys: ['t', '←'],
          description: t('help-modal.shortcuts-description.move-time-range-back', 'Move time range back'),
        },
        {
          keys: ['t', '→'],
          description: t('help-modal.shortcuts-description.move-time-range-forward', 'Move time range forward'),
        },
        {
          keys: ['t', 'a'],
          description: t(
            'help-modal.shortcuts-description.make-time-range-permanent',
            'Make time range absolute/permanent'
          ),
        },
      ],
    },
  ];
};

export interface HelpModalProps {
  onDismiss: () => void;
}

export const HelpModal = ({ onDismiss }: HelpModalProps): JSX.Element => {
  const styles = useStyles2(getStyles);
  const modKey = useMemo(() => getModKey(), []);
  const shortcuts = useMemo(() => getShortcuts(modKey), [modKey]);
  return (
    <Modal title={t('help-modal.title', 'Shortcuts')} isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
      <div className={styles.categories}>
        {Object.values(shortcuts).map(({ category, shortcuts }, i) => (
          <div className={styles.shortcutCategory} key={i}>
            <table className={styles.shortcutTable}>
              <tbody>
                <tr>
                  <th className={styles.shortcutTableCategoryHeader} colSpan={2}>
                    {category}
                  </th>
                </tr>
                {shortcuts.map((shortcut, j) => (
                  <tr key={`${i}-${j}`}>
                    <td className={styles.shortcutTableKeys}>
                      {shortcut.keys.map((key, k) => (
                        <span className={styles.shortcutTableKey} key={`${i}-${j}-${k}`}>
                          {key}
                        </span>
                      ))}
                    </td>
                    <td className={styles.shortcutTableDescription}>{shortcut.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    titleDescription: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.bodySmall.fontWeight};
      color: ${theme.colors.text.disabled};
      padding-bottom: ${theme.spacing(2)};
    `,
    categories: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
      flex-flow: row wrap;
      justify-content: space-between;
      align-items: flex-start;
    `,
    shortcutCategory: css`
      width: 50%;
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    shortcutTable: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    shortcutTableCategoryHeader: css`
      font-weight: normal;
      font-size: ${theme.typography.h6.fontSize};
      text-align: left;
    `,
    shortcutTableDescription: css`
      text-align: left;
      color: ${theme.colors.text.disabled};
      width: 99%;
      padding: ${theme.spacing(1, 2)};
    `,
    shortcutTableKeys: css`
      white-space: nowrap;
      width: 1%;
      text-align: right;
      color: ${theme.colors.text.primary};
    `,
    shortcutTableKey: css`
      display: inline-block;
      text-align: center;
      margin-right: ${theme.spacing(0.5)};
      padding: 3px 5px;
      font:
        11px Consolas,
        'Liberation Mono',
        Menlo,
        Courier,
        monospace;
      line-height: 10px;
      vertical-align: middle;
      border: solid 1px ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius(3)};
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.secondary};
    `,
  };
}
