import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Modal, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

const getShortcuts = (modKey: string) => {
  return {
    Global: [
      { keys: ['g', 'h'], description: 'Go to Home Dashboard' },
      { keys: ['g', 'e'], description: 'Go to Explore' },
      { keys: ['g', 'p'], description: 'Go to Profile' },
      { keys: [`${modKey} + k`], description: 'Open search' },
      { keys: ['esc'], description: 'Exit edit/setting views' },
      { keys: ['h'], description: 'Show all keyboard shortcuts' },
      { keys: ['c', 't'], description: 'Change theme' },
    ],
    Dashboard: [
      { keys: [`${modKey}+s`], description: 'Save dashboard' },
      { keys: ['d', 'r'], description: 'Refresh all panels' },
      { keys: ['d', 's'], description: 'Dashboard settings' },
      { keys: ['d', 'v'], description: 'Toggle in-active / view mode' },
      { keys: ['d', 'k'], description: 'Toggle kiosk mode (hides top nav)' },
      { keys: ['d', 'E'], description: 'Expand all rows' },
      { keys: ['d', 'C'], description: 'Collapse all rows' },
      { keys: ['d', 'a'], description: 'Toggle auto fit panels (experimental feature)' },
      { keys: [`${modKey} + o`], description: 'Toggle shared graph crosshair' },
      { keys: ['d', 'l'], description: 'Toggle all panel legends' },
    ],
    'Focused Panel': [
      { keys: ['e'], description: 'Toggle panel edit view' },
      { keys: ['v'], description: 'Toggle panel fullscreen view' },
      { keys: ['p', 's'], description: 'Open Panel Share Modal' },
      { keys: ['p', 'd'], description: 'Duplicate Panel' },
      { keys: ['p', 'r'], description: 'Remove Panel' },
      { keys: ['p', 'l'], description: 'Toggle panel legend' },
    ],
    'Time Range': [
      { keys: ['t', 'z'], description: 'Zoom out time range' },
      {
        keys: ['t', '←'],
        description: 'Move time range back',
      },
      {
        keys: ['t', '→'],
        description: 'Move time range forward',
      },
      {
        keys: ['t', 'a'],
        description: 'Make time range absolute/permanent',
      },
    ],
  };
};

export interface HelpModalProps {
  onDismiss: () => void;
}

export const HelpModal = ({ onDismiss }: HelpModalProps): JSX.Element => {
  const styles = useStyles2(getStyles);
  const modKey = useMemo(() => getModKey(), []);
  const shortcuts = useMemo(() => getShortcuts(modKey), [modKey]);
  return (
    <Modal title="Shortcuts" isOpen onDismiss={onDismiss} onClickBackdrop={onDismiss}>
      <div className={styles.categories}>
        {Object.entries(shortcuts).map(([category, shortcuts], i) => (
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
      font: 11px Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      line-height: 10px;
      vertical-align: middle;
      border: solid 1px ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius(3)};
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.secondary};
    `,
  };
}
