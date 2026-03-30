import { css } from '@emotion/css';
import { useState, useSyncExternalStore } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Button,
  ColorPickerInput,
  Field,
  FieldSet,
  Input,
  RadioButtonGroup,
  Select,
  Spinner,
  Stack,
  TextArea,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { Team } from 'app/types/teams';

import { PALETTE_GENERATION_PROMPT, PALETTE_GENERATION_SKILL } from './paletteGenerationSkill';
import { deleteTeamPalette, getTeamPalettesSnapshot, saveTeamPalette, subscribeTeamPalettes } from './teamPalettesStore';

interface Props {
  team: Team;
}

interface PaletteEntry {
  hex: string;
  name: string;
  role: string;
}

const BRAND_CATEGORIES = [
  { label: 'Technology', value: 'technology' },
  { label: 'Finance', value: 'finance' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Retail', value: 'retail' },
  { label: 'Education', value: 'education' },
  { label: 'Other', value: 'other' },
];

const PALETTE_TYPES = [
  { label: 'Primary', value: 'primary' },
  { label: 'Secondary', value: 'secondary' },
  { label: 'Accent', value: 'accent' },
];

const GENERATION_METHODS = [
  { label: 'Upload File', value: 'upload' },
  { label: 'AI from Images', value: 'ai-images' },
  { label: 'AI from Colors', value: 'ai-colors' },
];

const DEFAULT_BRAND_COLORS = ['#F15B2A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
const BRAND_COLOR_COUNT = 7;

function parsePaletteJson(text: string): PaletteEntry[] | null {
  // Strip markdown fences if present
  const stripped = text.replace(/```[a-z]*\n?/gi, '').trim();
  // Find the first {...} block
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) {
    return null;
  }
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    if (Array.isArray(parsed.palette) && parsed.palette.length > 0) {
      return distributePalette(parsed.palette.filter((e) => isUsableColor(e)));
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

/**
 * Reorder palette entries for maximum sequential contrast using greedy
 * farthest-point sampling: each next color is the one whose minimum distance
 * to all already-selected colors is greatest. This ensures no two adjacent
 * entries look similar and the first N series colors are maximally spread.
 */
function distributePalette(entries: PaletteEntry[]): PaletteEntry[] {
  if (entries.length <= 1) {
    return entries;
  }

  const remaining = entries.map((e, originalIndex) => ({ entry: e, originalIndex }));
  const result: Array<{ entry: PaletteEntry; originalIndex: number }> = [];

  // Seed with the first entry
  result.push(remaining.splice(0, 1)[0]);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDist = -1;

    for (let i = 0; i < remaining.length; i++) {
      // Minimum distance from candidate to any already-selected color
      let minDist = Infinity;
      for (const selected of result) {
        const d = rgbDistance(remaining[i].entry.hex, selected.entry.hex);
        if (d < minDist) {
          minDist = d;
        }
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result.map((r) => r.entry);
}

function rgbDistance(hexA: string, hexB: string): number {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) {
    return 0;
  }
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Parse a hex string to [r, g, b] in 0–255. Returns null for invalid input. */
function parseHex(hex: string): [number, number, number] | null {
  // Normalise: strip #, lowercase, expand 3-char shorthand, strip alpha channel
  let h = hex.replace(/^#/, '').toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  } else if (h.length === 8) {
    h = h.slice(0, 6); // Drop alpha
  }
  if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) {
    return null;
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Drop entries that fall outside the usable visualization range:
 * HSL lightness [25%, 85%] and saturation ≥ 20%.
 * This removes near-blacks, near-whites, dark greys, and desaturated colors
 * regardless of what the model produces.
 */
function isUsableColor(entry: PaletteEntry): boolean {
  const rgb = parseHex(entry.hex);
  if (!rgb) {
    return false;
  }
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const cmax = Math.max(r, g, b);
  const cmin = Math.min(r, g, b);
  const l = (cmax + cmin) / 2;
  const s = cmax === cmin ? 0 : l > 0.5 ? (cmax - cmin) / (2 - cmax - cmin) : (cmax - cmin) / (cmax + cmin);
  return l * 100 >= 25 && l * 100 <= 85 && s * 100 >= 20;
}

export const TeamVisualizationOptions = ({ team }: Props) => {
  const canWrite = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsWrite, team);
  const styles = useStyles2(getStyles);

  const [paletteName, setPaletteName] = useState('');
  const [brandCategory, setBrandCategory] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [paletteType, setPaletteType] = useState('primary');
  const [generationMethod, setGenerationMethod] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [brandColors, setBrandColors] = useState<string[]>(DEFAULT_BRAND_COLORS);
  const [generatedPalette, setGeneratedPalette] = useState<PaletteEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const { generate, isGenerating, error: generateError, reset: resetGenerate } = useInlineAssistant();
  const notifyApp = useAppNotification();
  const savedPalettes = useSyncExternalStore(subscribeTeamPalettes, getTeamPalettesSnapshot);

  const updateBrandColor = (index: number, color: string) => {
    setBrandColors((prev) => prev.map((c, i) => (i === index ? color : c)));
  };

  const handleGenerateWithAI = async () => {
    setGeneratedPalette(null);
    setParseError(null);
    resetGenerate();

    await generate({
      origin: 'grafana/team-settings/palette-generation',
      prompt: PALETTE_GENERATION_PROMPT(brandColors),
      systemPrompt: PALETTE_GENERATION_SKILL,
      onComplete: (text) => {
        const palette = parsePaletteJson(text);
        if (palette) {
          setGeneratedPalette(palette);
        } else {
          setParseError(
            t(
              'teams.visualization-options.parse-error',
              'The assistant did not return a valid palette. Please try again.'
            )
          );
        }
      },
    });
  };

  const handleSave = () => {
    const colors = generatedPalette!.map((e) => e.hex);
    saveTeamPalette({
      id: `team-palette-${paletteName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: paletteName,
      colors,
    });
    notifyApp.success(
      t('teams.visualization-options.save-success', 'Palette "{{name}}" saved', { name: paletteName })
    );
  };

  return (
    <FieldSet label={t('teams.visualization-options.section-title', 'Visualization options')}>
      <Stack direction="column" gap={2} maxWidth="600px">
        <p className={styles.description}>
          <Trans i18nKey="teams.visualization-options.description">
            Custom palettes defined here are available across all dashboards for this team.
          </Trans>
        </p>

        <h6 className={styles.subheading}>
          <Trans i18nKey="teams.visualization-options.brand-info">Brand Information</Trans>
        </h6>

        <div className={styles.row}>
          <Field
            noMargin
            label={t('teams.visualization-options.palette-name', 'Palette Name')}
            required
            className={styles.fieldHalf}
          >
            <Input
              id="palette-name-input"
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="e.g. Corporate Brand 2024"
              value={paletteName}
              onChange={(e) => setPaletteName(e.currentTarget.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field
            noMargin
            label={t('teams.visualization-options.brand-category', 'Brand Category')}
            className={styles.fieldHalf}
          >
            <Select
              inputId="brand-category-select"
              options={BRAND_CATEGORIES}
              value={brandCategory}
              onChange={(v) => setBrandCategory(v?.value)}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="Select category"
              disabled={!canWrite}
            />
          </Field>
        </div>

        <Field noMargin label={t('teams.visualization-options.description-field', 'Description')}>
          <TextArea
            id="palette-description-input"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="Brief description of the palette and its intended use..."
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            rows={3}
            disabled={!canWrite}
          />
        </Field>

        <Field noMargin label={t('teams.visualization-options.palette-type', 'Palette Type')}>
          <RadioButtonGroup
            options={PALETTE_TYPES}
            value={paletteType}
            onChange={setPaletteType}
            fullWidth
            disabled={!canWrite}
          />
        </Field>

        <h6 className={styles.subheading}>
          <Trans i18nKey="teams.visualization-options.generate-title">Generate 50-Color Palette</Trans>
        </h6>

        <Field noMargin label={t('teams.visualization-options.generation-method', 'Generation Method')}>
          <RadioButtonGroup
            options={GENERATION_METHODS}
            value={generationMethod}
            onChange={setGenerationMethod}
            fullWidth
            disabled={!canWrite}
          />
        </Field>

        {generationMethod === 'upload' && (
          <div className={styles.methodBox}>
            <p className={styles.methodTitle}>
              <Trans i18nKey="teams.visualization-options.upload-title">Upload Color File</Trans>
            </p>
            <p className={styles.methodDesc}>
              <Trans i18nKey="teams.visualization-options.upload-desc">
                Upload a file containing at least 50 HEX or RGB color codes. Accepted formats: .txt, .csv, .json, .aco
                (Adobe Color Swatch)
              </Trans>
            </p>
            <div className={styles.fileInputRow}>
              <label className={canWrite ? styles.chooseFileBtn : styles.chooseFileBtnDisabled}>
                <Trans i18nKey="teams.visualization-options.choose-file">Choose file</Trans>
                <input
                  type="file"
                  accept=".txt,.csv,.json,.aco"
                  className={styles.hiddenInput}
                  disabled={!canWrite}
                  onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? '')}
                />
              </label>
              <span className={styles.fileName}>{fileName || 'No file chosen'}</span>
            </div>
            <div className={styles.exampleBox}>
              <p className={styles.exampleTitle}>
                <Trans i18nKey="teams.visualization-options.example-title">Example file format:</Trans>
              </p>
              <code className={styles.exampleCode}>
                {'#FF6B6B\n#4ECDC4\nrgb(69, 183, 209)\nor JSON: [{"hex": "#FF6B6B"}, ...]'}
              </code>
            </div>
          </div>
        )}

        {generationMethod === 'ai-images' && (
          <div className={styles.methodBox}>
            <p className={styles.methodTitle}>
              <Trans i18nKey="teams.visualization-options.ai-images-title">AI from Images</Trans>
            </p>
            <p className={styles.methodDesc}>
              <Trans i18nKey="teams.visualization-options.ai-images-desc">
                Upload brand images and AI will extract a 50-color palette from them.
              </Trans>
            </p>
          </div>
        )}

        {generationMethod === 'ai-colors' && (
          <div className={styles.methodBox}>
            <p className={styles.methodTitle}>
              <Trans i18nKey="teams.visualization-options.ai-colors-title">AI from Colors</Trans>
            </p>
            <p className={styles.methodDesc}>
              <Trans i18nKey="teams.visualization-options.ai-colors-desc">
                Enter your {BRAND_COLOR_COUNT} brand colors. The Grafana Assistant will generate a cohesive 50-color
                palette following accessibility and color-harmony guardrails.
              </Trans>
            </p>

            <div className={styles.colorGrid}>
              {brandColors.map((color, index) => (
                <div key={index} className={styles.colorEntry}>
                  <span className={styles.colorLabel}>
                    {t('teams.visualization-options.brand-color-label', 'Color {{n}}', { n: index + 1 })}
                  </span>
                  <ColorPickerInput
                    value={color}
                    onChange={(c) => updateBrandColor(index, c)}
                    disabled={!canWrite}
                  />
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              icon={isGenerating ? undefined : 'ai'}
              onClick={handleGenerateWithAI}
              disabled={!canWrite || brandColors.some((c) => !c) || isGenerating}
              className={styles.generateBtn}
            >
              {isGenerating ? (
                <>
                  <Spinner inline className={styles.spinner} />
                  <Trans i18nKey="teams.visualization-options.generating">Generating palette…</Trans>
                </>
              ) : (
                <Trans i18nKey="teams.visualization-options.generate-btn">
                  Generate palette with Grafana Assistant
                </Trans>
              )}
            </Button>

            {(generateError || parseError) && (
              <Alert
                severity="error"
                title={t('teams.visualization-options.generation-failed', 'Generation failed')}
                className={styles.alert}
              >
                {generateError?.message ?? parseError}
              </Alert>
            )}

            {generatedPalette && (
              <div className={styles.palettePreview}>
                <p className={styles.palettePreviewLabel}>
                  <Trans i18nKey="teams.visualization-options.palette-preview">
                    Generated palette — {generatedPalette.length} colors
                  </Trans>
                </p>
                <div className={styles.paletteStrip}>
                  {generatedPalette.map((entry, i) => (
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    <Tooltip key={i} content={`${entry.name} ${entry.hex}`} placement="top">
                      <span className={styles.paletteSwatch} style={{ backgroundColor: entry.hex }} />
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canWrite || !paletteName || (generationMethod === 'ai-colors' && !generatedPalette)}
        >
          <Trans i18nKey="teams.visualization-options.save-palette">Save Palette</Trans>
        </Button>

        {savedPalettes.length > 0 && (
          <>
            <h6 className={styles.subheading}>
              <Trans i18nKey="teams.visualization-options.saved-palettes">Saved Palettes</Trans>
            </h6>
            <div className={styles.savedPalettesList}>
              {savedPalettes.map((palette) => (
                <div key={palette.id} className={styles.savedPaletteRow}>
                  <div className={styles.savedPaletteThumbnail}>
                    {palette.colors.slice(0, 8).map((color, i) => (
                      <span key={i} className={styles.savedPaletteSwatch} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className={styles.savedPaletteName}>{palette.name}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    icon="trash-alt"
                    aria-label={t('teams.visualization-options.delete-palette', 'Delete palette {{name}}', {
                      name: palette.name,
                    })}
                    disabled={!canWrite}
                    onClick={() => {
                      deleteTeamPalette(palette.id);
                      notifyApp.success(
                        t('teams.visualization-options.delete-success', 'Palette "{{name}}" deleted', {
                          name: palette.name,
                        })
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Stack>
    </FieldSet>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    description: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      margin: 0,
    }),
    subheading: css({
      fontSize: theme.typography.body.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      margin: 0,
      paddingBottom: theme.spacing(0.75),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      width: '100%',
    }),
    row: css({
      display: 'flex',
      gap: theme.spacing(2),
      width: '100%',
    }),
    fieldHalf: css({
      flex: 1,
      minWidth: 0,
    }),
    methodBox: css({
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      width: '100%',
    }),
    methodTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      marginBottom: theme.spacing(0.5),
    }),
    methodDesc: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: theme.spacing(1.5),
    }),
    colorGrid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    }),
    colorEntry: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    colorLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    generateBtn: css({
      width: '100%',
    }),
    spinner: css({
      marginRight: theme.spacing(1),
    }),
    alert: css({
      marginTop: theme.spacing(1.5),
    }),
    palettePreview: css({
      marginTop: theme.spacing(1.5),
    }),
    palettePreviewLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing(0.75),
    }),
    paletteStrip: css({
      display: 'flex',
      height: 32,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      width: '100%',
    }),
    paletteSwatch: css({
      flex: 1,
      height: '100%',
    }),
    fileInputRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
    }),
    chooseFileBtn: css({
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.strong}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      '&:hover': {
        background: theme.colors.action.hover,
      },
    }),
    chooseFileBtnDisabled: css({
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'not-allowed',
      whiteSpace: 'nowrap',
    }),
    hiddenInput: css({
      display: 'none',
    }),
    fileName: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    exampleBox: css({
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1.5),
    }),
    exampleTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: theme.spacing(0.5),
    }),
    exampleCode: css({
      display: 'block',
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      whiteSpace: 'pre',
    }),
    savedPalettesList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      width: '100%',
    }),
    savedPaletteRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    savedPaletteThumbnail: css({
      display: 'flex',
      height: 24,
      width: 120,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      flexShrink: 0,
    }),
    savedPaletteSwatch: css({
      flex: 1,
      height: '100%',
    }),
    savedPaletteName: css({
      flex: 1,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
