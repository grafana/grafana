import { css, cx } from '@emotion/css';
import { useId, useMemo, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Icon, RadioButtonGroup, Stack, Text, TextArea, useStyles2, useTheme2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { edit } from '../actions/utils/edit';
import { makeEditAction } from '../actions/utils/makeEditAction';
import { type DashboardScene } from '../scene/DashboardScene';

import { AccentDot, PaletteSwatch } from './DashboardStyleSwitcher';
import { getEditorialFindings } from './editorialReview';
import { getStylePack, STYLE_PACKS } from './packs';
import { resolveDashboardStyle } from './resolveStyle';
import { type DashboardStyleChoice, type StylePack } from './types';

const changeLede = makeEditAction<DashboardScene, 'lede'>({
  actionId: 'dashboard.changeLede',
  description: 'Change dashboard lede',
  prop: 'lede',
});

function changeStyle(dashboard: DashboardScene, next: DashboardStyleChoice | undefined) {
  const previous = dashboard.state.style;
  edit({
    meta: { actionId: 'dashboard.changeStyle' },
    description: t('dashboard.edit-actions.dashboard-style', 'Change dashboard style'),
    source: dashboard,
    perform: () => dashboard.setState({ style: next }),
    undo: () => dashboard.setState({ style: previous }),
  });
}

/** Sidebar categories for the dashboard's report style, lede and editorial review. */
export function useReportCategories(dashboard: DashboardScene): OptionsPaneCategoryDescriptor[] {
  const ledeId = useId();

  return useMemo(() => {
    const style = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.sidebar.report.title', 'Report'),
      id: 'dashboard-report-style',
      isOpenDefault: true,
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.report.lede', 'Lede'),
          id: ledeId,
          description: t(
            'dashboard.sidebar.report.lede-description',
            'One sentence with the main finding. Opens the dashboard with the title and an automatic scope line.'
          ),
          render: () => <LedeInput dashboard={dashboard} id={ledeId} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.sidebar.report.style', 'Style'),
          id: 'dashboard-report-style-pack',
          description: t(
            'dashboard.sidebar.report.style-description',
            'Typography, colour, surfaces and rules. Content stays the same in every style.'
          ),
          render: () => <StylePicker dashboard={dashboard} />,
        })
      );

    const review = new OptionsPaneCategoryDescriptor({
      title: t('dashboard.sidebar.report.review', 'Editorial review'),
      id: 'dashboard-report-review',
      isOpenDefault: false,
    }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: 'dashboard-report-review-list',
        skipField: true,
        render: () => <EditorialReview dashboard={dashboard} />,
      })
    );

    return [style, review];
  }, [dashboard, ledeId]);
}

function LedeInput({ dashboard, id }: { dashboard: DashboardScene; id: string }) {
  const { lede } = dashboard.useState();
  const before = useRef<string | undefined>(undefined);

  return (
    <TextArea
      id={id}
      rows={3}
      value={lede ?? ''}
      placeholder={t(
        'dashboard.sidebar.report.lede-placeholder',
        'Checkout overspent its error budget; two more SLOs are close.'
      )}
      data-testid={selectors.components.DashboardStyle.ledeInput}
      onFocus={() => (before.current = dashboard.state.lede)}
      onChange={(e) => dashboard.setState({ lede: e.currentTarget.value || undefined })}
      onBlur={() => {
        if (before.current !== dashboard.state.lede) {
          changeLede({ source: dashboard, oldValue: before.current, newValue: dashboard.state.lede });
        }
      }}
    />
  );
}

function StylePicker({ dashboard }: { dashboard: DashboardScene }) {
  const { style } = dashboard.useState();
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const mode = theme.isDark ? 'dark' : 'light';
  const pack = getStylePack(style?.pack);

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.packs} role="radiogroup" data-testid={selectors.components.DashboardStyle.picker}>
        <button
          type="button"
          role="radio"
          aria-checked={!pack}
          className={cx(styles.pack, !pack && styles.packSelected)}
          onClick={() => changeStyle(dashboard, undefined)}
        >
          <span
            className={styles.specimen}
            style={{ background: theme.colors.background.canvas, color: theme.colors.text.secondary }}
            aria-hidden
          >
            <span className={styles.specimenFace}>{t('dashboard.sidebar.report.specimen-glyphs', 'Aa')}</span>
          </span>
          <span className={styles.packText}>
            <span className={styles.packName}>
              <Trans i18nKey="dashboard.sidebar.report.style-none">No style</Trans>
            </span>
            <span className={styles.packSummary}>
              <Trans i18nKey="dashboard.sidebar.report.style-none-description">The dashboard as Grafana draws it</Trans>
            </span>
          </span>
        </button>
        {STYLE_PACKS.map((option) => (
          <PackCard
            key={option.id}
            pack={option}
            selected={option.id === pack?.id}
            onSelect={() => changeStyle(dashboard, { pack: option.id })}
          />
        ))}
      </div>
      {pack && style && (
        <>
          {pack.palettes.length > 1 && (
            <div
              className={styles.swatches}
              role="radiogroup"
              aria-label={t('dashboard.sidebar.report.palette', 'Palette')}
            >
              {pack.palettes.map((palette) => (
                <PaletteSwatch
                  key={palette.id}
                  palette={palette}
                  mode={mode}
                  selected={palette.id === (style.palette ?? pack.defaults.palette)}
                  onSelect={() => changeStyle(dashboard, { ...style, palette: palette.id })}
                />
              ))}
            </div>
          )}
          <Stack gap={1} wrap="wrap" role="radiogroup" aria-label={t('dashboard.sidebar.report.accent', 'Accent')}>
            <AccentDot
              label={t('dashboard.style-switcher.accent-palette', 'Palette accent')}
              color={pack.palettes.find((p) => p.id === (style.palette ?? pack.defaults.palette))?.[mode].accent ?? ''}
              selected={!style.accent}
              onSelect={() => changeStyle(dashboard, { ...style, accent: undefined })}
            />
            {pack.accents.map((accent) => (
              <AccentDot
                key={accent.id}
                label={accent.name}
                color={accent[mode]}
                selected={accent.id === style.accent}
                onSelect={() => changeStyle(dashboard, { ...style, accent: accent.id })}
              />
            ))}
          </Stack>
          <RadioButtonGroup
            size="sm"
            fullWidth
            value={style.typography ?? pack.defaults.typography}
            options={pack.typography.map((option) => ({ value: option.id, label: option.name }))}
            onChange={(value) => changeStyle(dashboard, { ...style, typography: value })}
          />
        </>
      )}
    </Stack>
  );
}

/** A small specimen of the pack: headline face, rule, prose and accent, in its own colours. */
function PackCard({ pack, selected, onSelect }: { pack: StylePack; selected: boolean; onSelect: () => void }) {
  const styles = useStyles2(getStyles);
  const hostTheme = useTheme2();
  const resolved = resolveDashboardStyle({ pack: pack.id }, hostTheme)!;
  const { colors, typography } = resolved;
  const { treatments } = pack;
  const rule =
    treatments.sectionRule === 'heavy'
      ? `3px solid ${colors.ink}`
      : treatments.sectionRule === 'none'
        ? 'none'
        : `1px ${treatments.sectionRule === 'dashed' ? 'dashed' : 'solid'} ${colors.line}`;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.pack, selected && styles.packSelected)}
      onClick={onSelect}
    >
      <span
        className={styles.specimen}
        style={{ background: colors.bg, color: colors.ink, borderTop: rule }}
        aria-hidden
      >
        <span
          className={styles.specimenFace}
          style={{
            fontFamily: typography.display,
            fontWeight: typography.headingWeight,
            letterSpacing: typography.headingTracking,
          }}
        >
          {t('dashboard.sidebar.report.specimen-glyphs', 'Aa')}
        </span>
        <span className={styles.specimenFoot}>
          <span style={{ fontFamily: typography.display, fontWeight: typography.figureWeight }}>
            {(99.4).toLocaleString()}
          </span>
          <span className={styles.specimenBars}>
            {[0.5, 0.8, 0.35, 1].map((height, index) => (
              <span
                key={index}
                style={{
                  height: `${height * 100}%`,
                  background: index === 3 ? colors.accent : colors.muted,
                  opacity: index === 3 ? 1 : 0.45,
                }}
              />
            ))}
          </span>
        </span>
      </span>
      <span className={styles.packText}>
        <span className={styles.packName}>{pack.name}</span>
        <span className={styles.packSummary}>{pack.summary}</span>
      </span>
    </button>
  );
}

function EditorialReview({ dashboard }: { dashboard: DashboardScene }) {
  const state = dashboard.useState();
  const styles = useStyles2(getStyles);
  // Recomputed when the dashboard state changes; cheap enough for the sizes dashboards reach.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const findings = useMemo(() => getEditorialFindings(dashboard), [dashboard, state]);

  if (findings.length === 0) {
    return (
      <Stack gap={1} alignItems="center" data-testid={selectors.components.DashboardStyle.review}>
        <Icon name="check-circle" className={styles.good} />
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="dashboard.review.clear">
            Nothing to flag. The dashboard opens on a finding and every section says what it shows.
          </Trans>
        </Text>
      </Stack>
    );
  }

  return (
    <ul className={styles.findings} data-testid={selectors.components.DashboardStyle.review}>
      {findings.map((finding) => (
        <li key={finding.id}>
          <button
            type="button"
            className={styles.finding}
            disabled={!finding.target}
            onClick={() => finding.target && dashboard.state.sidebar?.selectObject(finding.target, { force: true })}
          >
            <span className={styles.findingRule}>{finding.rule}</span>
            <span>{finding.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    packs: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    pack: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.75),
      textAlign: 'left',
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': { borderColor: theme.colors.border.strong },
      '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 2 },
    }),
    packSelected: css({
      borderColor: theme.colors.primary.border,
      boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
    }),
    packText: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
    }),
    packName: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    packSummary: css({
      fontSize: '0.6875rem',
      lineHeight: 1.35,
      color: theme.colors.text.secondary,
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
    specimen: css({
      flex: '0 0 64px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height: 64,
      padding: theme.spacing(0.5, 0.75),
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      boxShadow: `inset 0 0 0 1px ${theme.colors.border.weak}`,
    }),
    specimenFace: css({
      fontSize: 24,
      lineHeight: 1.1,
    }),
    specimenFoot: css({
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      fontSize: 13,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums lining-nums',
    }),
    specimenBars: css({
      display: 'flex',
      alignItems: 'flex-end',
      gap: 1.5,
      height: 13,
      '& > span': { width: 3, borderRadius: theme.shape.radius.default },
    }),
    swatches: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: theme.spacing(1),
    }),
    findings: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    finding: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      width: '100%',
      padding: theme.spacing(0.75, 1),
      textAlign: 'left',
      background: 'none',
      border: 'none',
      borderLeft: `2px solid ${theme.colors.warning.border}`,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      '&:hover:not(:disabled)': { background: theme.colors.action.hover },
      '&:disabled': { cursor: 'default' },
    }),
    findingRule: css({
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.warning.text,
    }),
    good: css({ color: theme.colors.success.text, flexShrink: 0 }),
  };
}
