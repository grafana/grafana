import { css, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

/** One full loop: outlines sketch in one by one, the contents fill in, then everything clears. */
const CYCLE_SECONDS = 8;
/** Percent of the cycle at which the first outline starts, the gap between outlines, and how long each takes. */
const FIRST_OUTLINE = 4;
const OUTLINE_STEP = 6;
const OUTLINE_DURATION = 12;
/** Percent of the cycle at which every panel's contents start to fade in, and how long that takes. */
const FILL_AT = 62;
const FILL_DURATION = 8;
const HOLD_UNTIL = 88;
const CLEARED_AT = 96;

interface PanelShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STAT_XS = [12, 69, 126, 183];
const STATS: PanelShape[] = STAT_XS.map((x) => ({ x, y: 24, width: 45, height: 30 }));
const LINE_PANEL: PanelShape = { x: 12, y: 62, width: 102, height: 54 };
const BAR_PANEL: PanelShape = { x: 126, y: 62, width: 102, height: 54 };
const TABLE_PANEL: PanelShape = { x: 12, y: 124, width: 216, height: 26 };
const PANELS = [...STATS, LINE_PANEL, BAR_PANEL, TABLE_PANEL];
const BAR_HEIGHTS = [18, 28, 14, 32, 22];

/**
 * A stylised dashboard being sketched out, on a loop: each panel's outline draws in turn, then
 * their contents fill in together. Decorative: the text beside it carries the meaning, so it is
 * hidden from assistive technology. With reduced motion it shows the finished dashboard, still.
 */
export function PlanBuildingAnimation() {
  const styles = useStyles2(getStyles);

  return (
    <svg className={styles.svg} viewBox="0 0 240 160" aria-hidden="true" focusable="false">
      <rect className={styles.frame} x="1" y="1" width="238" height="158" rx="6" />
      <rect className={styles.skeleton} x="12" y="10" width="64" height="6" rx="3" />

      <g className={styles.contents}>
        {PANELS.map((panel, index) => (
          <rect key={index} className={styles.panelBox} {...panel} rx="3" />
        ))}

        {STATS.map(({ x, y }) => (
          <g key={x}>
            <rect className={styles.skeleton} x={x + 6} y={y + 6} width="18" height="3" rx="1.5" />
            <rect className={styles.accent} x={x + 6} y={y + 15} width="24" height="8" rx="2" />
          </g>
        ))}

        <rect className={styles.skeleton} x="18" y="68" width="32" height="3" rx="1.5" />
        <path className={styles.line} d="M20 106 L36 96 L50 100 L64 86 L78 92 L92 78 L106 84" fill="none" />

        <rect className={styles.skeleton} x="132" y="68" width="32" height="3" rx="1.5" />
        {BAR_HEIGHTS.map((height, index) => (
          <rect
            key={index}
            className={styles.bar}
            x={138 + index * 17}
            y={108 - height}
            width="10"
            height={height}
            rx="1.5"
          />
        ))}

        <rect className={styles.skeleton} x="18" y="131" width="120" height="3" rx="1.5" />
        <rect className={styles.skeleton} x="18" y="140" width="88" height="3" rx="1.5" />
      </g>

      {PANELS.map((panel, index) => (
        <rect key={index} className={styles.outline[index]} {...panel} rx="3" pathLength={1} />
      ))}
    </svg>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const easing = theme.transitions.easing.easeOut;

  const outline = PANELS.map((_, index) => {
    const start = FIRST_OUTLINE + index * OUTLINE_STEP;
    const sketch = keyframes({
      [`0%, ${start}%`]: { strokeDashoffset: 1, opacity: 1 },
      [`${start + OUTLINE_DURATION}%, ${HOLD_UNTIL}%`]: { strokeDashoffset: 0, opacity: 1 },
      [`${CLEARED_AT}%, 100%`]: { strokeDashoffset: 0, opacity: 0 },
    });
    return css({
      fill: 'none',
      stroke: theme.colors.border.medium,
      strokeDasharray: 1,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${sketch} ${CYCLE_SECONDS}s ${easing} infinite`,
      },
    });
  });

  const fill = keyframes({
    [`0%, ${FILL_AT}%`]: { opacity: 0 },
    [`${FILL_AT + FILL_DURATION}%, ${HOLD_UNTIL}%`]: { opacity: 1 },
    [`${CLEARED_AT}%, 100%`]: { opacity: 0 },
  });

  return {
    svg: css({
      display: 'block',
      width: '100%',
      maxWidth: 320,
      height: 'auto',
    }),
    frame: css({
      fill: theme.colors.background.primary,
      stroke: theme.colors.border.medium,
    }),
    contents: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${fill} ${CYCLE_SECONDS}s ${easing} infinite`,
      },
    }),
    panelBox: css({
      fill: theme.colors.background.secondary,
      stroke: theme.colors.border.weak,
    }),
    skeleton: css({
      fill: theme.colors.text.disabled,
    }),
    accent: css({
      fill: theme.colors.primary.main,
    }),
    line: css({
      stroke: theme.colors.primary.main,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    bar: css({
      fill: theme.colors.primary.main,
      opacity: 0.7,
    }),
    outline,
  };
}
