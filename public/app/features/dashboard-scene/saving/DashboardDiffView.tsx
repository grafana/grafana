import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ControlsLabel, type SceneVariable, sceneUtils, type VizPanel } from '@grafana/scenes';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { DashboardConfigDiff } from './DashboardConfigDiff';
import {
  buildVisualDiff,
  type ChangeType,
  type FieldChange,
  type PanelChangeRow,
  type VariableChangeRow,
} from './dashboardDiffModel';

interface Props {
  dashboard: DashboardScene;
  oldValue: Dashboard | DashboardV2Spec;
  newValue: Dashboard | DashboardV2Spec;
}

const PANEL_ID_PREFIX = 'visual-diff-panel';
const VARIABLE_ID_PREFIX = 'visual-diff-variable';
const OPTION_ID_PREFIX = 'visual-diff-option';

/**
 * Visual, side-by-side diff of a dashboard's changes. Unlike the JSON "Changes" tab this renders
 * the actual panels (old version on the left, new on the right) with live query data, by building a
 * throwaway scene for each version and rendering only the panels that differ. Each row can be
 * dismissed, which reverts that single change in the live dashboard so it is excluded on save.
 */
export function DashboardDiffView({ dashboard, oldValue, newValue }: Props) {
  const styles = useStyles2(getStyles);

  // The diff is a snapshot taken when the tab opens. The save model is recomputed (new references)
  // on every render of the drawer, so build the throwaway scenes once rather than on every render.
  const [model, setModel] = useState(() => buildVisualDiff(dashboard, oldValue, newValue));
  const { oldScene, newScene, oldPanels, newPanels, panelRows, variableRows, optionChanges } = model;

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

  const dismissPanel = (row: PanelChangeRow) => {
    row.revert();
    setModel((current) => ({ ...current, panelRows: current.panelRows.filter((other) => other !== row) }));
  };

  const dismissVariable = (row: VariableChangeRow) => {
    row.revert();
    setModel((current) => ({ ...current, variableRows: current.variableRows.filter((other) => other !== row) }));
  };

  const dismissOption = (change: FieldChange) => {
    change.revert();
    setModel((current) => ({ ...current, optionChanges: current.optionChanges.filter((other) => other !== change) }));
  };

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const outlineSections = useMemo<OutlineSectionData[]>(
    () => [
      {
        title: t('dashboard-scene.dashboard-diff-view.outline-panels', 'Panels'),
        items: panelRows.map((row, index) => ({
          id: panelAnchorId(index),
          label: row.title || t('dashboard-scene.dashboard-diff-view.outline-untitled-panel', 'Untitled panel'),
          type: row.type,
        })),
      },
      {
        title: t('dashboard-scene.dashboard-diff-view.outline-variables', 'Variables'),
        items: variableRows.map((row, index) => ({
          id: variableAnchorId(index),
          label: row.name,
          type: row.type,
        })),
      },
      {
        title: t('dashboard-scene.dashboard-diff-view.outline-options', 'Dashboard options'),
        items: optionChanges.map((change, index) => ({
          id: optionAnchorId(index),
          label: change.label,
          type: change.type,
        })),
      },
    ],
    [panelRows, variableRows, optionChanges]
  );

  return (
    <div className={styles.layout}>
      <DiffOutline sections={outlineSections} onItemClick={scrollTo} styles={styles} />

      <div className={styles.main}>
        <Stack direction="column" gap={2}>
          <div className={styles.header}>
            <div className={cx(styles.headerCol, styles.oldHeader)}>
              <Text element="h4" color="error">
                <Trans i18nKey="dashboard-scene.dashboard-diff-view.old-heading">Old</Trans>
              </Text>
            </div>
            <div className={styles.divider} />
            <div className={cx(styles.headerCol, styles.newHeader)}>
              <Text element="h4" color="success">
                <Trans i18nKey="dashboard-scene.dashboard-diff-view.new-heading">New</Trans>
              </Text>
            </div>
            <div className={styles.actions} />
          </div>

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
                {panelRows.map((row, index) => (
                  <PanelDiffRow
                    key={row.id}
                    anchorId={panelAnchorId(index)}
                    row={row}
                    oldPanel={oldPanels.get(row.id)}
                    newPanel={newPanels.get(row.id)}
                    styles={styles}
                    onDismiss={dismissPanel}
                  />
                ))}
              </Stack>
            )}
          </section>

          <section>
            <Text element="h4">
              <Trans i18nKey="dashboard-scene.dashboard-diff-view.variables-heading">Variables</Trans>
            </Text>
            {variableRows.length === 0 ? (
              <Text color="secondary">
                <Trans i18nKey="dashboard-scene.dashboard-diff-view.no-variable-changes">No variable changes</Trans>
              </Text>
            ) : (
              <Stack direction="column" gap={2}>
                {variableRows.map((row, index) => (
                  <VariableDiffRow
                    key={row.name}
                    anchorId={variableAnchorId(index)}
                    row={row}
                    styles={styles}
                    onDismiss={dismissVariable}
                  />
                ))}
              </Stack>
            )}
          </section>

          <DashboardConfigDiff optionChanges={optionChanges} onDismiss={dismissOption} anchorId={optionAnchorId} />
        </Stack>
      </div>
    </div>
  );
}

function panelAnchorId(index: number) {
  return `${PANEL_ID_PREFIX}-${index}`;
}

function variableAnchorId(index: number) {
  return `${VARIABLE_ID_PREFIX}-${index}`;
}

function optionAnchorId(index: number) {
  return `${OPTION_ID_PREFIX}-${index}`;
}

interface OutlineSectionData {
  title: string;
  items: OutlineItemData[];
}

interface OutlineItemData {
  id: string;
  label: string;
  type: ChangeType;
}

interface DiffOutlineProps {
  sections: OutlineSectionData[];
  onItemClick: (id: string) => void;
  styles: ReturnType<typeof getStyles>;
}

function DiffOutline({ sections, onItemClick, styles }: DiffOutlineProps) {
  const hasAnyItem = sections.some((section) => section.items.length > 0);

  return (
    <aside className={styles.outline} aria-label={t('dashboard-scene.dashboard-diff-view.outline-aria', 'Diff outline')}>
      <Text element="h4">
        <Trans i18nKey="dashboard-scene.dashboard-diff-view.outline-heading">Outline</Trans>
      </Text>
      {!hasAnyItem ? (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="dashboard-scene.dashboard-diff-view.outline-empty">No changes</Trans>
        </Text>
      ) : (
        <Stack direction="column" gap={2}>
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <div key={section.title}>
                <div className={styles.outlineSectionTitle}>
                  <Text variant="bodySmall" color="secondary">
                    {section.title}
                  </Text>
                </div>
                <ul className={styles.outlineList}>
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={styles.outlineItem}
                        onClick={() => onItemClick(item.id)}
                        title={item.label}
                      >
                        <span className={cx(styles.outlineDot, styles.outlineDotFor[item.type])} aria-hidden />
                        <span className={styles.outlineLabel}>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </Stack>
      )}
    </aside>
  );
}

interface PanelDiffRowProps {
  anchorId: string;
  row: PanelChangeRow;
  oldPanel?: VizPanel;
  newPanel?: VizPanel;
  styles: ReturnType<typeof getStyles>;
  onDismiss: (row: PanelChangeRow) => void;
}

function PanelDiffRow({ anchorId, row, oldPanel, newPanel, styles, onDismiss }: PanelDiffRowProps) {
  return (
    <div id={anchorId} className={styles.row}>
      <PanelColumn panel={oldPanel} height={row.height} styles={styles} kind="old" />
      <div className={styles.divider} />
      <PanelColumn panel={newPanel} height={row.height} styles={styles} kind="new" />
      <div className={styles.actions}>
        <IconButton
          name="history"
          tooltip={t('dashboard-scene.dashboard-diff-view.dismiss-tooltip', 'Revert this change')}
          onClick={() => onDismiss(row)}
        />
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
      <div className={cx(styles.panelBox, kind === 'old' ? styles.panelBoxOld : styles.panelBoxNew)} style={{ height }}>
        <panel.Component model={panel} />
      </div>
    </div>
  );
}

interface VariableDiffRowProps {
  anchorId: string;
  row: VariableChangeRow;
  styles: ReturnType<typeof getStyles>;
  onDismiss: (row: VariableChangeRow) => void;
}

function VariableDiffRow({ anchorId, row, styles, onDismiss }: VariableDiffRowProps) {
  return (
    <div id={anchorId} className={styles.row}>
      <VariableColumn variable={row.oldVariable} styles={styles} kind="old" />
      <div className={styles.divider} />
      <VariableColumn variable={row.newVariable} styles={styles} kind="new" />
      <div className={styles.actions}>
        <IconButton
          name="history"
          tooltip={t('dashboard-scene.dashboard-diff-view.dismiss-tooltip', 'Revert this change')}
          onClick={() => onDismiss(row)}
        />
      </div>
    </div>
  );
}

interface VariableColumnProps {
  variable?: SceneVariable;
  styles: ReturnType<typeof getStyles>;
  kind: 'old' | 'new';
}

function VariableColumn({ variable, styles, kind }: VariableColumnProps) {
  if (!variable) {
    return (
      <div className={styles.column}>
        <div className={styles.variablePlaceholder}>
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

  const labelOrName = variable.state.label || variable.state.name;
  const elementId = sceneUtils.getVariableControlId(variable.state.type, variable.state.key);

  return (
    <div className={styles.column}>
      <div className={cx(styles.variableBox, kind === 'old' ? styles.variableBoxOld : styles.variableBoxNew)}>
        <div className={styles.variableControl}>
          <ControlsLabel htmlFor={elementId} label={labelOrName} layout="horizontal" />
          <variable.Component model={variable} />
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    layout: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing(3),
      width: '100%',
    }),
    outline: css({
      flexShrink: 0,
      width: 240,
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start',
      maxHeight: '100vh',
      overflowY: 'auto',
      paddingRight: theme.spacing(1),
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    outlineSectionTitle: css({
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }),
    outlineList: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
    }),
    outlineItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
      textAlign: 'left',
      background: 'transparent',
      border: 'none',
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: 1,
      },
    }),
    outlineDot: css({
      flexShrink: 0,
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
    }),
    outlineDotFor: {
      added: css({ background: theme.colors.success.main }),
      removed: css({ background: theme.colors.error.main }),
      changed: css({ background: theme.colors.warning.main }),
    } satisfies Record<ChangeType, string>,
    outlineLabel: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    main: css({
      flex: 1,
      minWidth: 0,
    }),
    header: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      position: 'sticky',
      top: 0,
      zIndex: theme.zIndex.navbarFixed,
      background: theme.colors.background.primary,
      padding: theme.spacing(1, 0),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    headerCol: css({
      flex: 1,
      minWidth: 0,
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
    }),
    oldHeader: css({
      background: theme.colors.error.transparent,
    }),
    newHeader: css({
      background: theme.colors.success.transparent,
    }),
    divider: css({
      flexShrink: 0,
      width: 1,
      alignSelf: 'stretch',
      background: theme.colors.border.medium,
    }),
    actions: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: theme.spacing(4),
    }),
    row: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      marginTop: theme.spacing(1),
      scrollMarginTop: theme.spacing(6),
    }),
    column: css({
      flex: 1,
      minWidth: 0,
    }),
    panelBox: css({
      position: 'relative',
      width: '100%',
      border: `2px solid transparent`,
      borderRadius: theme.shape.radius.default,
    }),
    panelBoxOld: css({
      borderColor: theme.colors.error.border,
      background: theme.colors.error.transparent,
    }),
    panelBoxNew: css({
      borderColor: theme.colors.success.border,
      background: theme.colors.success.transparent,
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
    variableBox: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      alignItems: 'center',
      minHeight: theme.spacing(4),
      padding: theme.spacing(1),
      border: `2px solid transparent`,
      borderRadius: theme.shape.radius.default,
    }),
    variableBoxOld: css({
      borderColor: theme.colors.error.border,
      background: theme.colors.error.transparent,
    }),
    variableBoxNew: css({
      borderColor: theme.colors.success.border,
      background: theme.colors.success.transparent,
    }),
    variableControl: css({
      display: 'inline-flex',
      alignItems: 'center',
      // Join the label and the value control by removing the control's left rounding, matching how
      // variable controls render in the dashboard.
      '> :nth-child(2)': {
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
      },
    }),
    variablePlaceholder: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.spacing(4),
      padding: theme.spacing(1),
      border: `1px dashed ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
    }),
  };
}
