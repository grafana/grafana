import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Grid, Modal, useStyles2, Text } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getModKey } from 'app/core/utils/browser';

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
          keys: [`${modKey} + h`],
          description: t('help-modal.shortcuts-description.show-all-shortcuts', 'Show all keyboard shortcuts'),
        },
        { keys: ['c', 't'], description: t('help-modal.shortcuts-description.change-theme', 'Change theme') },
      ],
    },
    {
      category: t('help-modal.shortcuts-category.dashboard', 'Dashboard'),
      shortcuts: [
        {
          keys: [`${modKey} + s`],
          description: t('help-modal.shortcuts-description.save-dashboard', 'Save dashboard'),
        },
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
        {
          keys: ['t', 'c'],
          description: t('help-modal.shortcuts-description.copy-time-range', 'Copy time range'),
        },
        {
          keys: ['t', 'v'],
          description: t('help-modal.shortcuts-description.paste-time-range', 'Paste time range'),
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
      <Grid columns={{ xs: 1, sm: 2 }} gap={3}>
        {Object.values(shortcuts).map(({ category, shortcuts }) => (
          <section key={category}>
            <div className={styles.categoryHeader}>
              <Text element="h3" variant="h5">
                {category}
              </Text>
            </div>
            <dl className={styles.keysAndDescriptions}>
              {shortcuts.map(({ keys, description }) => (
                <>
                  <dt key={keys.join()} className={styles.keys}>
                    {keys.map((key) => (
                      <Key key={key}>{key}</Key>
                    ))}
                  </dt>
                  <dd key={description}>
                    <Text variant="bodySmall">{description}</Text>
                  </dd>
                </>
              ))}
            </dl>
          </section>
        ))}
      </Grid>
    </Modal>
  );
};

interface KeyProps {
  children: string;
}

const Key = ({ children }: KeyProps) => {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.shortcutTableKey}>
      <Text variant="code">{children}</Text>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    categoryHeader: css({
      marginBottom: theme.spacing(2),
    }),
    keysAndDescriptions: css({
      display: 'grid',
      gridTemplateColumns: 'minmax(75px, max-content) 1fr',
      gap: theme.spacing(2),
      alignItems: 'center',
      alignSelf: 'baseline',
    }),
    keys: css({
      justifySelf: 'end',
    }),
    shortcutTableKey: css({
      display: 'inline-block',
      textAlign: 'center',
      marginRight: theme.spacing(0.5),
      padding: '3px 5px',
      lineHeight: '10px',
      verticalAlign: 'middle',
      border: `solid 1px ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background.secondary,
    }),
  };
}
