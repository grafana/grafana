import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  GraphDrawStyle,
  LegendDisplayMode,
  LineInterpolation,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';
import { Switch, useStyles2 } from '@grafana/ui';
import { type VizPanel } from '@grafana/scenes';

import { PalettePicker } from './PalettePicker';
import { ScrubbableNumberInput } from './ScrubbableNumberInput';
import { SegmentedIconToggle } from './SegmentedIconToggle';
import { type InspectorMode } from './PanelInspectorModeToggle';

interface Props {
  panel: VizPanel;
  inspectorMode: InspectorMode;
}

export function TimeSeriesStyleCards({ panel, inspectorMode }: Props) {
  const styles = useStyles2(getStyles);
  const { options, fieldConfig } = panel.useState();
  const custom = fieldConfig.defaults.custom as Record<string, unknown>;

  const drawStyle = (custom.drawStyle as GraphDrawStyle) ?? GraphDrawStyle.Line;
  const lineInterp = (custom.lineInterpolation as LineInterpolation) ?? LineInterpolation.Linear;
  const lineWidth = (custom.lineWidth as number) ?? 1;
  const fillOpacity = (custom.fillOpacity as number) ?? 0;
  const showPoints = (custom.showPoints as VisibilityMode) ?? VisibilityMode.Auto;
  const stacked = !!(custom.stacking as { mode?: string })?.mode && (custom.stacking as { mode: string }).mode !== 'none';
  const colorMode = fieldConfig.defaults.color?.mode ?? 'palette-classic';
  const legend = (options as Record<string, unknown>).legend as { showLegend: boolean; placement: string; displayMode: LegendDisplayMode };
  const tooltip = (options as Record<string, unknown>).tooltip as { mode: TooltipDisplayMode };

  function patchCustom(patch: Record<string, unknown>) {
    panel.onFieldConfigChange(
      {
        ...fieldConfig,
        defaults: {
          ...fieldConfig.defaults,
          custom: { ...fieldConfig.defaults.custom, ...patch },
        },
      },
      true
    );
  }

  function patchOptions(patch: Record<string, unknown>) {
    panel.onOptionsChange({ ...(options as object), ...patch } as typeof options, true);
  }

  function patchColor(mode: string) {
    panel.onFieldConfigChange(
      {
        ...fieldConfig,
        defaults: {
          ...fieldConfig.defaults,
          color: { ...fieldConfig.defaults.color, mode },
        },
      },
      true
    );
  }

  return (
    <>
      {/* Graph styles card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Graph styles</span>
        </div>
        <div className={styles.cardBody}>
          {/* Draw style */}
          <div className={styles.row}>
            <span className={styles.label}>Style</span>
            <div className={styles.control}>
              <SegmentedIconToggle
                value={drawStyle}
                onChange={(v) => patchCustom({ drawStyle: v })}
                options={[
                  { value: GraphDrawStyle.Line, icon: 'chart-line', label: 'Lines', title: 'Lines' },
                  { value: GraphDrawStyle.Bars, icon: 'graph-bar', label: 'Bars', title: 'Bars' },
                  { value: GraphDrawStyle.Points, icon: 'circle-mono', label: 'Points', title: 'Points' },
                ]}
              />
            </div>
          </div>

          {/* Line interpolation — only when lines */}
          {drawStyle === GraphDrawStyle.Line && (
            <div className={styles.row}>
              <span className={styles.label}>Line</span>
              <div className={styles.control}>
                <SegmentedIconToggle
                  value={lineInterp}
                  onChange={(v) => patchCustom({ lineInterpolation: v })}
                  iconOnly
                  options={[
                    { value: LineInterpolation.Linear, icon: 'gf-interpolation-linear', title: 'Linear' },
                    { value: LineInterpolation.Smooth, icon: 'gf-interpolation-smooth', title: 'Smooth' },
                    { value: LineInterpolation.StepAfter, icon: 'gf-interpolation-step-after', title: 'Step after' },
                    { value: LineInterpolation.StepBefore, icon: 'gf-interpolation-step-before', title: 'Step before' },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Line width */}
          {drawStyle !== GraphDrawStyle.Points && (
            <div className={styles.row}>
              <span className={styles.label}>Width</span>
              <div className={styles.control}>
                <ScrubbableNumberInput
                  value={lineWidth}
                  onChange={(v) => patchCustom({ lineWidth: v })}
                  min={0}
                  max={10}
                  step={1}
                  suffix="px"
                  width={72}
                />
              </div>
            </div>
          )}

          {/* Fill opacity */}
          {drawStyle !== GraphDrawStyle.Points && (
            <div className={styles.row}>
              <span className={styles.label}>Fill</span>
              <div className={styles.control}>
                <ScrubbableNumberInput
                  value={Math.round(fillOpacity * 100)}
                  onChange={(v) => patchCustom({ fillOpacity: v / 100 })}
                  min={0}
                  max={100}
                  step={5}
                  suffix="%"
                  width={72}
                />
              </div>
            </div>
          )}

          {/* Show points */}
          <div className={styles.row}>
            <span className={styles.label}>Points</span>
            <div className={styles.control}>
              <SegmentedIconToggle
                value={showPoints}
                onChange={(v) => patchCustom({ showPoints: v })}
                options={[
                  { value: VisibilityMode.Auto, label: 'Auto', title: 'Auto' },
                  { value: VisibilityMode.Always, label: 'On', title: 'Always on' },
                  { value: VisibilityMode.Never, label: 'Off', title: 'Always off' },
                ]}
              />
            </div>
          </div>

          {/* Stack */}
          <div className={styles.row}>
            <span className={styles.label}>Stack</span>
            <div className={styles.control}>
              <Switch
                value={stacked}
                onChange={(e) =>
                  patchCustom({ stacking: { mode: e.currentTarget.checked ? 'normal' : 'none', group: 'A' } })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Colors card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Colors</span>
        </div>
        <div className={styles.cardBody}>
          <PalettePicker value={colorMode} onChange={patchColor} />
        </div>
      </div>

      {/* Legend card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Legend</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.row}>
            <span className={styles.label}>Visible</span>
            <div className={styles.control}>
              <Switch
                value={legend?.showLegend ?? true}
                onChange={(e) =>
                  patchOptions({ legend: { ...legend, showLegend: e.currentTarget.checked } })
                }
              />
            </div>
          </div>
          {legend?.showLegend !== false && (
            <>
              <div className={styles.row}>
                <span className={styles.label}>Position</span>
                <div className={styles.control}>
                  <SegmentedIconToggle
                    value={legend?.placement ?? 'bottom'}
                    onChange={(v) => patchOptions({ legend: { ...legend, placement: v } })}
                    iconOnly
                    options={[
                      { value: 'bottom', icon: 'arrow-down', title: 'Bottom' },
                      { value: 'right', icon: 'arrow-right', title: 'Right' },
                    ]}
                  />
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Layout</span>
                <div className={styles.control}>
                  <SegmentedIconToggle
                    value={legend?.displayMode ?? LegendDisplayMode.List}
                    onChange={(v) => patchOptions({ legend: { ...legend, displayMode: v } })}
                    options={[
                      { value: LegendDisplayMode.List, icon: 'list-ul', label: 'List', title: 'List' },
                      { value: LegendDisplayMode.Table, icon: 'list-ui-alt', label: 'Table', title: 'Table' },
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tooltip card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Tooltip</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.row}>
            <span className={styles.label}>Mode</span>
            <div className={styles.control}>
              <SegmentedIconToggle
                value={tooltip?.mode ?? TooltipDisplayMode.Single}
                onChange={(v) => patchOptions({ tooltip: { ...tooltip, mode: v } })}
                options={[
                  { value: TooltipDisplayMode.Single, icon: 'crosshair', label: 'Single', title: 'Single series' },
                  { value: TooltipDisplayMode.Multi, icon: 'list-ul', label: 'All', title: 'All series' },
                  { value: TooltipDisplayMode.None, icon: 'eye-slash', label: 'Off', title: 'Hidden' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    card: css({
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
    }),
    cardHeader: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(1, 1.25),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    cardTitle: css({
      fontSize: 11,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: theme.colors.text.primary,
      flex: 1,
    }),
    cardBody: css({
      padding: theme.spacing(1.25),
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      marginBottom: theme.spacing(0.75),
      minHeight: 26,
      '&:last-child': {
        marginBottom: 0,
      },
    }),
    label: css({
      flex: '0 0 56px',
      fontSize: 11,
      color: theme.colors.text.secondary,
    }),
    control: css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
    }),
  };
}
