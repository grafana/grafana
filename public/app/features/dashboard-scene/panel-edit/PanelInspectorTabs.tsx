import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

import { type TabId } from './categoryRouting';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

export function PanelInspectorTabs({ activeTab, onChangeTab }: Props) {
  const styles = useStyles2(getStyles);

  const tabs: Tab[] = [
    {
      id: 'viz',
      label: t('panel-edit.inspector-tab.viz', 'Viz'),
      icon: <Icon name="chart-line" size="sm" />,
    },
    {
      id: 'style',
      label: t('panel-edit.inspector-tab.style', 'Style'),
      icon: <Icon name="palette" size="sm" />,
    },
    {
      id: 'data',
      label: t('panel-edit.inspector-tab.data', 'Data'),
      icon: <Icon name="sliders-v-alt" size="sm" />,
    },
    {
      id: 'rules',
      label: t('panel-edit.inspector-tab.rules', 'Rules'),
      icon: <Icon name="layer-group" size="sm" />,
    },
  ];

  return (
    <div className={styles.tabStrip} role="tablist">
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isSelected}
            className={isSelected ? styles.tabSelected : styles.tab}
            onClick={() => onChangeTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const tabBase = css({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 0.75),
    border: 'none',
    background: 'transparent',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    fontFamily: 'inherit',
    cursor: 'pointer',
    marginBottom: -1,
    borderBottom: '2px solid transparent',
    transition: 'color 120ms cubic-bezier(0.2, 0, 0.2, 1)',
    ':focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: '-2px',
    },
    ':hover': {
      background: theme.colors.action.hover,
    },
  });

  return {
    tabStrip: css({
      display: 'flex',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(0.75, 0.75, 0),
      gap: theme.spacing(0.25),
    }),
    tab: css(tabBase, {
      color: theme.colors.text.secondary,
    }),
    tabSelected: css(tabBase, {
      color: theme.colors.text.primary,
      borderBottomColor: theme.colors.primary.text,
    }),
  };
}
