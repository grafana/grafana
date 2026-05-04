import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Badge, Button, Icon, Text, useStyles2 } from '@grafana/ui';
import { SqlEditorMode } from 'app/features/sql-prototype/editor/SqlEditorMode';

import { AiPanel } from './AiPanel';
import { AiPanelSidebar } from './AiPanelSidebar';
import { MockViz } from './MockViz';

interface MockPanel {
  id: number;
  title: string;
  type: 'timeseries' | 'barchart' | 'stat' | 'ai';
}

const MOCK_PANELS: MockPanel[] = [
  { id: 1, title: 'New panel', type: 'ai' },
  { id: 2, title: 'Single series, few data points', type: 'timeseries' },
  { id: 3, title: 'Single series, many data points', type: 'timeseries' },
  { id: 4, title: 'Multiple series, few data points', type: 'barchart' },
  { id: 5, title: 'Multi series', type: 'timeseries' },
];

export function DashboardPrototypePage() {
  const styles = useStyles2(getStyles);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [workbenchSql, setWorkbenchSql] = useState<string | null>(null);

  if (!config.featureToggles.sqlAbstractionPrototype) {
    return (
      <div className={styles.disabled}>
        <Icon name="lock" size="xl" />
        <Text variant="h4">Feature flag required</Text>
        <Text color="secondary">Enable the <code>sqlAbstractionPrototype</code> feature flag to view this prototype.</Text>
      </div>
    );
  }

  // SQL workbench view — replaces the dashboard grid
  if (workbenchSql !== null) {
    return (
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Button size="sm" variant="secondary" icon="arrow-left" onClick={() => setWorkbenchSql(null)}>
              Back to dashboard
            </Button>
            <Text variant="h6">SQL Workbench</Text>
            <Badge text="Prototype" color="orange" />
          </div>
        </div>
        <div className={styles.workbenchBody}>
          <SqlEditorMode initialSql={workbenchSql} />
        </div>
      </div>
    );
  }

  const selectedPanel = MOCK_PANELS.find((p) => p.id === selectedPanelId) ?? null;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Icon name="dashboard" />
          <Text variant="h6">SQL Prototype — Dashboard</Text>
          <Badge text="Prototype" color="orange" />
        </div>
        <div className={styles.toolbarRight}>
          <Button
            size="sm"
            variant={isEditing ? 'primary' : 'secondary'}
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? 'Exit edit' : 'Edit'}
          </Button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Panel grid */}
        <div className={styles.gridWrap}>
          <div className={styles.grid}>
            {MOCK_PANELS.map((panel) => (
              <PanelTile
                key={panel.id}
                panel={panel}
                isSelected={selectedPanelId === panel.id}
                isEditing={isEditing}
                onClick={() => setSelectedPanelId(panel.id === selectedPanelId ? null : panel.id)}
                onEditInSqlEditor={(sql) => setWorkbenchSql(sql)}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar — shown when a panel is selected */}
        {selectedPanel && isEditing && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <Text variant="h6">Panel</Text>
              <button className={styles.closeSidebar} onClick={() => setSelectedPanelId(null)}>
                <Icon name="times" />
              </button>
            </div>

            <AiPanelSidebar panelTitle={selectedPanel.title} />

            <div className={styles.sidebarSection}>
              <Button variant="primary" fullWidth icon="sliders-v-alt">
                Configure
              </Button>
            </div>

            <div className={styles.sidebarSection}>
              <Text variant="bodySmall" color="secondary">
                Title
              </Text>
              <div className={styles.fakeInput}>{selectedPanel.title}</div>
            </div>

            <div className={styles.sidebarSection}>
              <Text variant="bodySmall" color="secondary">
                Description
              </Text>
              <div className={styles.fakeInputMulti} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PanelTileProps {
  panel: MockPanel;
  isSelected: boolean;
  isEditing: boolean;
  onClick: () => void;
  onEditInSqlEditor: (sql: string) => void;
}

function PanelTile({ panel, isSelected, isEditing, onClick, onEditInSqlEditor }: PanelTileProps) {
  const styles = useStyles2(getPanelStyles);

  return (
    <div
      className={`${styles.tile} ${isSelected ? styles.selected : ''} ${isEditing ? styles.editing : ''}`}
      onClick={onClick}
    >
      <div className={styles.tileHeader}>
        <Text variant="bodySmall" weight="medium">
          {panel.title}
        </Text>
      </div>
      <div className={styles.tileBody}>
        {panel.type === 'ai' ? (
          <AiPanel onEditInSqlEditor={onEditInSqlEditor} />
        ) : (
          <MockViz type={panel.type} title={panel.title} />
        )}
      </div>
    </div>
  );
}


function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: theme.colors.background.canvas,
      overflow: 'hidden',
    }),
    toolbar: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 2),
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    toolbarLeft: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    toolbarRight: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    body: css({
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    }),
    workbenchBody: css({
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    }),
    gridWrap: css({
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(2),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: theme.spacing(2),
    }),
    sidebar: css({
      width: 280,
      flexShrink: 0,
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }),
    sidebarHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    closeSidebar: css({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      '&:hover': { color: theme.colors.text.primary },
    }),
    sidebarSection: css({
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    fakeInput: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.75, 1),
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
    }),
    fakeInputMulti: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      height: 60,
    }),
    disabled: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: theme.spacing(1),
    }),
  };
}

function getPanelStyles(theme: GrafanaTheme2) {
  return {
    tile: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      cursor: 'pointer',
      height: 240,
      display: 'flex',
      flexDirection: 'column',
      transition: 'box-shadow 0.15s',
    }),
    selected: css({
      border: `2px solid ${theme.colors.primary.border}`,
      boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
    }),
    editing: css({
      '&:hover': {
        boxShadow: theme.shadows.z2,
      },
    }),
    tileHeader: css({
      padding: theme.spacing(0.75, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      flexShrink: 0,
    }),
    tileBody: css({
      flex: 1,
      overflow: 'hidden',
      padding: 0,
    }),
  };
}

