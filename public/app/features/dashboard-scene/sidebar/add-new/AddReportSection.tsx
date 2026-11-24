import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';
import { Text, Tooltip, useStyles2 } from '@grafana/ui';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { addReportSectionTo, type ReportSectionPreset } from '../../scene/layouts-shared/addReportSection';
import { getNestingRestrictionMessage, useNestingRestrictions } from '../../scene/layouts-shared/nestingRestrictions';
import { isLayoutParent } from '../../scene/types/LayoutParent';
import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { AddButton } from './AddButton';

interface Props {
  dashboardScene: DashboardSceneLike;
  selectedElement: SceneObject | undefined;
}

interface PresetInfo {
  id: Exclude<ReportSectionPreset, 'section'>;
  label: string;
  description: string;
}

export function AddReportSection({ dashboardScene, selectedElement }: Props) {
  const styles = useStyles2(getStyles);
  const [isAdding, setIsAdding] = useState(false);

  // A selected row gets a sibling section rather than a nested one; reports read top to bottom.
  const layout = useMemo(() => {
    if (selectedElement instanceof RowItem) {
      return selectedElement.getParentLayout();
    }
    if (selectedElement && isLayoutParent(selectedElement)) {
      return selectedElement.getLayout();
    }
    return dashboardScene.getLayout();
  }, [dashboardScene, selectedElement]);

  const { disableGrouping } = useNestingRestrictions(layout);
  const disabledTooltip = disableGrouping ? getNestingRestrictionMessage() : undefined;

  const presets: PresetInfo[] = [
    {
      id: 'reading-flow',
      label: t('dashboard.sidebar.add.report.reading-flow', 'Reading flow'),
      description: t('dashboard.sidebar.add.report.reading-flow-description', 'One column, read top to bottom'),
    },
    {
      id: 'side-by-side',
      label: t('dashboard.sidebar.add.report.side-by-side', 'Side by side'),
      description: t('dashboard.sidebar.add.report.side-by-side-description', 'Two equal columns to compare'),
    },
    {
      id: 'evidence-note',
      label: t('dashboard.sidebar.add.report.evidence-note', 'Evidence + note'),
      description: t('dashboard.sidebar.add.report.evidence-note-description', 'A wide chart beside a written note'),
    },
  ];

  const add = async (preset: ReportSectionPreset) => {
    setIsAdding(true);
    try {
      await addReportSectionTo(layout, preset);
    } finally {
      setIsAdding(false);
    }
  };

  const isDisabled = disableGrouping || isAdding;

  return (
    <>
      <AddButton
        icon="file-alt"
        label={t('dashboard.sidebar.add.report.section', 'Report section')}
        testId={selectors.components.Sidebar.addReportSectionButton}
        onClick={() => add('section')}
        disabled={isDisabled}
        tooltip={disabledTooltip}
      />
      <div
        className={styles.presets}
        role="group"
        aria-label={t('dashboard.sidebar.add.report.presets', 'Report layout presets')}
      >
        {presets.map((preset) => (
          <Tooltip key={preset.id} content={disabledTooltip ?? preset.description} placement="bottom">
            <button
              type="button"
              className={styles.preset}
              onClick={() => add(preset.id)}
              disabled={isDisabled}
              aria-label={t('dashboard.sidebar.add.report.preset-aria-label', '{{label}}: {{description}}', {
                label: preset.label,
                description: preset.description,
                interpolation: { escapeValue: false },
              })}
              data-testid={selectors.components.Sidebar.addReportPreset(preset.id)}
            >
              <PresetDiagram preset={preset.id} />
              <Text variant="bodySmall" weight="medium">
                {preset.label}
              </Text>
            </button>
          </Tooltip>
        ))}
      </div>
    </>
  );
}

/** Schematic of the section the preset inserts: heading, prose, then panels. */
function PresetDiagram({ preset }: { preset: PresetInfo['id'] }) {
  const styles = useStyles2(getStyles);

  return (
    <svg viewBox="0 0 64 44" className={styles.diagram} aria-hidden="true">
      <rect x="4" y="4" width="30" height="4" rx="1" className={styles.heading} />
      <rect x="4" y="11" width="44" height="2" rx="1" className={styles.prose} />
      <rect x="4" y="15" width="36" height="2" rx="1" className={styles.prose} />
      {preset === 'reading-flow' && (
        <>
          <rect x="4" y="21" width="56" height="9" rx="1.5" className={styles.panel} />
          <rect x="4" y="32" width="56" height="9" rx="1.5" className={styles.panel} />
        </>
      )}
      {preset === 'side-by-side' && (
        <>
          <rect x="4" y="21" width="27" height="20" rx="1.5" className={styles.panel} />
          <rect x="33" y="21" width="27" height="20" rx="1.5" className={styles.panel} />
        </>
      )}
      {preset === 'evidence-note' && (
        <>
          <rect x="4" y="21" width="37" height="20" rx="1.5" className={styles.panel} />
          <polyline points="8,36 15,30 21,33 28,26 37,29" className={styles.line} />
          <rect x="43" y="21" width="17" height="20" rx="1.5" className={styles.note} />
          <rect x="46" y="25" width="11" height="1.5" rx="0.75" className={styles.prose} />
          <rect x="46" y="29" width="9" height="1.5" rx="0.75" className={styles.prose} />
          <rect x="46" y="33" width="10" height="1.5" rx="0.75" className={styles.prose} />
        </>
      )}
    </svg>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    presets: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: theme.spacing(1),
    }),
    preset: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 0.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      textAlign: 'center',
      '&:hover:not(:disabled)': {
        borderColor: theme.colors.border.strong,
        background: theme.colors.background.elevated,
        boxShadow: theme.shadows.z1,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: 2,
      },
      '&:disabled': {
        cursor: 'not-allowed',
        opacity: 0.5,
      },
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['border-color', 'background', 'box-shadow']),
      },
    }),
    diagram: css({
      width: '100%',
      maxWidth: 72,
      height: 'auto',
    }),
    heading: css({ fill: theme.colors.text.primary }),
    prose: css({ fill: theme.colors.text.disabled }),
    panel: css({
      fill: theme.colors.background.primary,
      stroke: theme.colors.border.medium,
      strokeWidth: 1,
    }),
    note: css({
      fill: theme.colors.background.primary,
      stroke: theme.colors.accent.main,
      strokeWidth: 1,
    }),
    line: css({
      fill: 'none',
      stroke: theme.colors.accent.main,
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  };
}
