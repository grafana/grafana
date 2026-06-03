import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { DashboardConfigDiff } from './DashboardConfigDiff';
import { buildVisualDiff, type ChangeType, type PanelChangeRow } from './dashboardDiffModel';

interface Props {
  dashboard: DashboardScene;
  oldValue: Dashboard | DashboardV2Spec;
  newValue: Dashboard | DashboardV2Spec;
}

/**
 * Visual, side-by-side diff of a dashboard's changes. Unlike the JSON "Changes" tab this renders
 * the actual panels (old version on the left, new on the right) with live query data, by building a
 * throwaway scene for each version and rendering only the panels that differ.
 */
export function DashboardDiffView({ dashboard, oldValue, newValue }: Props) {
  const styles = useStyles2(getStyles);

  // The diff is a snapshot taken when the tab opens. The save model is recomputed (new references)
  // on every render of the drawer, so build the throwaway scenes once rather than on every render.
  const [{ oldScene, newScene, oldPanels, newPanels, panelRows, variableChanges, optionChanges }] = useState(() =>
    buildVisualDiff(dashboard, oldValue, newValue)
  );

  // Activating the scenes activates their variable sets and time ranges, which the rendered panels
  // walk up to when running their queries. Only the panels we actually render get activated and
  // therefore only changed panels run queries.
  useEffect(() => {
    const deactivateOld = oldScene.activate();
    const deactivateNew = newScene.activate();
    return () => {
      deactivateOld();
      deactivateNew();
    };
  }, [oldScene, newScene]);

  return (
    <Stack direction="column" gap={2}>
      <section>
        <Text element="h4">
          <Trans i18nKey="dashboard-scene.dashboard-diff-view.panels-heading">Panels</Trans>
        </Text>
        {panelRows.length === 0 ? (
          <Text color="secondary">
            <Trans i18nKey="dashboard-scene.dashboard-diff-view.no-panel-changes">No panel changes</Trans>
          </Text>
        ) : (
          <Stack direction="column" gap={2}>
            {panelRows.map((row) => (
              <PanelDiffRow
                key={row.id}
                row={row}
                oldPanel={oldPanels.get(row.id)}
                newPanel={newPanels.get(row.id)}
                styles={styles}
              />
            ))}
          </Stack>
        )}
      </section>

      <DashboardConfigDiff variableChanges={variableChanges} optionChanges={optionChanges} />
    </Stack>
  );
}

interface PanelDiffRowProps {
  row: PanelChangeRow;
  oldPanel?: VizPanel;
  newPanel?: VizPanel;
  styles: ReturnType<typeof getStyles>;
}

function PanelDiffRow({ row, oldPanel, newPanel, styles }: PanelDiffRowProps) {
  return (
    <div>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h5">{row.title}</Text>
        <Text color="secondary" variant="bodySmall">
          {getChangeLabel(row.type)}
        </Text>
      </Stack>
      <div className={styles.row}>
        <PanelColumn panel={oldPanel} height={row.height} styles={styles} kind="old" />
        <PanelColumn panel={newPanel} height={row.height} styles={styles} kind="new" />
      </div>
    </div>
  );
}

interface PanelColumnProps {
  panel?: VizPanel;
  height: number;
  styles: ReturnType<typeof getStyles>;
  kind: 'old' | 'new';
}

function PanelColumn({ panel, height, styles, kind }: PanelColumnProps) {
  if (!panel) {
    return (
      <div className={styles.column}>
        <div className={styles.placeholder} style={{ height }}>
          <Text color="secondary" variant="bodySmall">
            {kind === 'old' ? (
              <Trans i18nKey="dashboard-scene.dashboard-diff-view.added-placeholder">Did not exist</Trans>
            ) : (
              <Trans i18nKey="dashboard-scene.dashboard-diff-view.removed-placeholder">Removed</Trans>
            )}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.column}>
      <div className={styles.panelBox} style={{ height }}>
        <panel.Component model={panel} />
      </div>
    </div>
  );
}

function getChangeLabel(type: ChangeType): string {
  switch (type) {
    case 'added':
      return t('dashboard-scene.dashboard-diff-view.label-added', 'Added');
    case 'removed':
      return t('dashboard-scene.dashboard-diff-view.label-removed', 'Removed');
    case 'changed':
      return t('dashboard-scene.dashboard-diff-view.label-changed', 'Changed');
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      marginTop: theme.spacing(1),
    }),
    column: css({
      flex: 1,
      minWidth: 0,
    }),
    panelBox: css({
      position: 'relative',
      width: '100%',
    }),
    placeholder: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      border: `1px dashed ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
    }),
  };
}
