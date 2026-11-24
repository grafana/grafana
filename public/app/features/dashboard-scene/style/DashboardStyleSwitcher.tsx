import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, RadioButtonGroup, Stack, Text, Toggletip, useStyles2, useTheme2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { getStylePack } from './packs';
import { type StyleAccent, type StylePalette } from './types';
import { setViewerStyleChoice, useViewerStyleChoice, type ViewerStyleChoice } from './viewerStyleChoice';

/**
 * Lets a viewer read a styled dashboard in another of its pack's palettes, accents or typefaces.
 * The choice stays in the viewer's browser and never changes the saved dashboard.
 */
export function DashboardStyleSwitcher({ dashboard }: { dashboard: DashboardScene }) {
  const { style, uid } = dashboard.useState();
  const viewer = useViewerStyleChoice(uid);
  const pack = getStylePack(style?.pack);
  const styles = useStyles2(getStyles);
  const mode = useTheme2().isDark ? 'dark' : 'light';

  if (!pack || !uid || !style) {
    return null;
  }

  const update = (change: ViewerStyleChoice) => setViewerStyleChoice(uid, { ...viewer, ...change });
  const palette = viewer?.palette ?? style.palette ?? pack.defaults.palette;
  const accent = viewer?.accent ?? style.accent;
  const typography = viewer?.typography ?? style.typography ?? pack.defaults.typography;
  const hasOverride = Boolean(viewer && Object.values(viewer).some(Boolean));

  const content = (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        {t('dashboard.style-switcher.description', '{{pack}} style. Your choice is saved in this browser only.', {
          pack: pack.name,
          interpolation: { escapeValue: false },
        })}
      </Text>
      {pack.palettes.length > 1 && (
        <section aria-label={t('dashboard.style-switcher.palette', 'Palette')}>
          <Text element="h3" variant="bodySmall" weight="medium">
            <Trans i18nKey="dashboard.style-switcher.palette">Palette</Trans>
          </Text>
          <div className={styles.swatches} role="radiogroup">
            {pack.palettes.map((option) => (
              <PaletteSwatch
                key={option.id}
                palette={option}
                mode={mode}
                selected={option.id === palette}
                onSelect={() => update({ palette: option.id === style.palette ? undefined : option.id })}
              />
            ))}
          </div>
        </section>
      )}
      <section aria-label={t('dashboard.style-switcher.accent', 'Accent')}>
        <Text element="h3" variant="bodySmall" weight="medium">
          <Trans i18nKey="dashboard.style-switcher.accent">Accent</Trans>
        </Text>
        <div className={styles.accents} role="radiogroup">
          <AccentDot
            label={t('dashboard.style-switcher.accent-palette', 'Palette accent')}
            color={pack.palettes.find((p) => p.id === palette)?.[mode].accent ?? ''}
            selected={!accent}
            onSelect={() => update({ accent: undefined })}
          />
          {pack.accents.map((option: StyleAccent) => (
            <AccentDot
              key={option.id}
              label={option.name}
              color={option[mode]}
              selected={option.id === accent}
              onSelect={() => update({ accent: option.id })}
            />
          ))}
        </div>
      </section>
      {pack.typography.length > 1 && (
        <section aria-label={t('dashboard.style-switcher.typography', 'Typography')}>
          <Text element="h3" variant="bodySmall" weight="medium">
            <Trans i18nKey="dashboard.style-switcher.typography">Typography</Trans>
          </Text>
          <RadioButtonGroup
            size="sm"
            fullWidth
            value={typography}
            options={pack.typography.map((option) => ({ value: option.id, label: option.name }))}
            onChange={(value) => update({ typography: value === style.typography ? undefined : value })}
          />
        </section>
      )}
      <Button
        size="sm"
        variant="secondary"
        fill="outline"
        disabled={!hasOverride}
        onClick={() => setViewerStyleChoice(uid, undefined)}
      >
        <Trans i18nKey="dashboard.style-switcher.reset">Use the author&apos;s style</Trans>
      </Button>
    </Stack>
  );

  return (
    <Toggletip content={content} placement="bottom-end" closeButton={false}>
      <Button
        variant="secondary"
        icon="palette"
        tooltip={t('dashboard.style-switcher.tooltip', 'Change palette, accent and type')}
        aria-label={t('dashboard.style-switcher.tooltip', 'Change palette, accent and type')}
        data-testid={selectors.components.DashboardStyle.switcher}
        className={cx(hasOverride && styles.active)}
      />
    </Toggletip>
  );
}

export function PaletteSwatch({
  palette,
  mode,
  selected,
  onSelect,
}: {
  palette: StylePalette;
  mode: 'dark' | 'light';
  selected: boolean;
  onSelect: () => void;
}) {
  const styles = useStyles2(getStyles);
  const colors = palette[mode];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cx(styles.swatch, selected && styles.selected)}
      onClick={onSelect}
      title={palette.note}
    >
      <span className={styles.swatchSample} style={{ background: colors.bg, color: colors.ink }} aria-hidden>
        <span style={{ background: colors.surface, borderColor: colors.line }} className={styles.swatchCard}>
          <span style={{ background: colors.ink }} className={styles.swatchLine} />
          <span style={{ background: colors.accent }} className={styles.swatchAccent} />
        </span>
      </span>
      <span className={styles.swatchName}>{palette.name}</span>
    </button>
  );
}

export function AccentDot({
  label,
  color,
  selected,
  onSelect,
}: {
  label: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const styles = useStyles2(getStyles);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      className={cx(styles.dot, selected && styles.dotSelected)}
      style={{ background: color }}
      onClick={onSelect}
    />
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    active: css({
      color: theme.colors.primary.text,
    }),
    swatches: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
      minWidth: 280,
    }),
    swatch: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0.5),
      background: 'none',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': { borderColor: theme.colors.border.strong },
      '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 2 },
    }),
    selected: css({
      borderColor: theme.colors.primary.border,
      boxShadow: `0 0 0 1px ${theme.colors.primary.border}`,
    }),
    swatchSample: css({
      display: 'block',
      height: 40,
      borderRadius: theme.shape.radius.default,
      padding: 6,
    }),
    swatchCard: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      height: '100%',
      padding: 4,
      border: '1px solid',
      borderRadius: theme.shape.radius.default,
    }),
    swatchLine: css({ display: 'block', height: 3, width: '70%', borderRadius: theme.shape.radius.default }),
    swatchAccent: css({ display: 'block', height: 3, width: '40%', borderRadius: theme.shape.radius.default }),
    swatchName: css({
      fontSize: theme.typography.bodySmall.fontSize,
      textAlign: 'left',
    }),
    accents: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    }),
    dot: css({
      width: 22,
      height: 22,
      borderRadius: theme.shape.radius.circle,
      border: `2px solid ${theme.colors.background.primary}`,
      boxShadow: `0 0 0 1px ${theme.colors.border.medium}`,
      cursor: 'pointer',
      '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 2 },
    }),
    dotSelected: css({
      boxShadow: `0 0 0 2px ${theme.colors.text.primary}`,
    }),
  };
}
