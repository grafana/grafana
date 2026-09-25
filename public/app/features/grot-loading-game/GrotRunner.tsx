import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { colorManipulator, store, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import grotSvg from 'img/grot-news.svg';

// Logical canvas size. The canvas is scaled by devicePixelRatio so it stays crisp.
const WIDTH = 480;
const HEIGHT = 150;
const GROUND_Y = HEIGHT - 22;

const GROT_X = 36;
const GROT_W = 44;
const GROT_H = 42;

const GRAVITY = 2400;
const JUMP_VELOCITY = -640;
const START_SPEED = 260;
const MAX_SPEED = 640;
const ACCELERATION = 10;

const BEST_SCORE_KEY = 'grafana.grotLoadingGame.best';

type ObstacleKind = 'bell' | 'pod';

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
}

interface GameState {
  grotY: number;
  velocityY: number;
  speed: number;
  obstacles: Obstacle[];
  nextSpawnIn: number;
  elapsedMs: number;
  groundOffset: number;
}

type Phase = 'idle' | 'running' | 'crashed';

function newGameState(): GameState {
  return {
    grotY: GROUND_Y - GROT_H,
    velocityY: 0,
    speed: START_SPEED,
    obstacles: [],
    nextSpawnIn: 0.8,
    elapsedMs: 0,
    groundOffset: 0,
  };
}

function readBest(): number {
  return Number(store.get(BEST_SCORE_KEY)) || 0;
}

function writeBest(score: number) {
  store.set(BEST_SCORE_KEY, score);
}

function spawnObstacle(): Obstacle {
  if (Math.random() < 0.55) {
    return { kind: 'bell', x: WIDTH + 10, w: 22, h: 26 };
  }
  // Pods sometimes come stacked two high, which needs a well timed jump.
  const stacked = Math.random() < 0.3;
  return { kind: 'pod', x: WIDTH + 10, w: 24, h: stacked ? 44 : 24 };
}

function overlaps(state: GameState, o: Obstacle) {
  // Shrink hitboxes a bit so near misses feel fair.
  const pad = 7;
  const grotTop = state.grotY + pad;
  const grotBottom = state.grotY + GROT_H - pad;
  const grotLeft = GROT_X + pad;
  const grotRight = GROT_X + GROT_W - pad;
  const oTop = GROUND_Y - o.h + 3;
  return grotRight > o.x + 3 && grotLeft < o.x + o.w - 3 && grotBottom > oTop && grotTop < GROUND_Y;
}

function drawBell(ctx: CanvasRenderingContext2D, o: Obstacle, color: string) {
  const cx = o.x + o.w / 2;
  const top = GROUND_Y - o.h;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, top + 2);
  ctx.quadraticCurveTo(o.x + o.w - 2, top + 4, o.x + o.w - 3, GROUND_Y - 7);
  ctx.lineTo(o.x + o.w, GROUND_Y - 4);
  ctx.lineTo(o.x, GROUND_Y - 4);
  ctx.lineTo(o.x + 3, GROUND_Y - 7);
  ctx.quadraticCurveTo(o.x + 2, top + 4, cx, top + 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, GROUND_Y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPod(ctx: CanvasRenderingContext2D, o: Obstacle, stroke: string, fill: string) {
  const size = 24;
  for (let y = GROUND_Y - size; y >= GROUND_Y - o.h; y -= size - 4) {
    const cx = o.x + o.w / 2;
    const cy = y + size / 2;
    const r = size / 2 - 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    // A little "x" marks the pod as broken.
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.moveTo(cx + 4, cy - 4);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.stroke();
  }
}

interface Props {
  /** Set once the thing we are waiting for has loaded. Stops the game and shows the ready message. */
  loadingDone: boolean;
  /** Shown when loadingDone flips, e.g. "Explore is ready". */
  readyLabel: string;
  onContinue: () => void;
}

/**
 * A tiny endless runner starring Grot, meant to be played while a slow backend warms up.
 * Space, arrow up, click or tap to jump over alert bells and broken pods.
 */
export function GrotRunner({ loadingDone, readyLabel, onContinue }: Props) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(newGameState());
  const phaseRef = useRef<Phase>('idle');
  const grotImage = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lastScore, setLastScore] = useState(0);
  const [best, setBest] = useState(readBest);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = grotSvg;
    grotImage.current = img;
  }, []);

  const jump = useCallback(() => {
    if (loadingDone) {
      return;
    }
    const state = stateRef.current;
    if (phaseRef.current !== 'running') {
      stateRef.current = newGameState();
      stateRef.current.velocityY = JUMP_VELOCITY;
      updatePhase('running');
      return;
    }
    if (state.grotY >= GROUND_Y - GROT_H - 0.5) {
      state.velocityY = JUMP_VELOCITY;
    }
  }, [loadingDone, updatePhase]);

  useEffect(() => {
    canvasRef.current?.focus();
  }, []);

  // Main loop: physics while running, a static frame otherwise.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const colors = {
      text: theme.colors.text.secondary,
      ground: theme.colors.border.medium,
      bell: theme.colors.error.main,
      podStroke: theme.colors.warning.main,
      podFill: theme.colors.warning.transparent,
      sparkline: theme.colors.primary.transparent,
    };

    let frame = 0;
    let last = performance.now();

    const draw = () => {
      const state = stateRef.current;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Faint metric line in the background, moving slower than the ground for a bit of depth.
      ctx.strokeStyle = colors.sparkline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= WIDTH; x += 8) {
        const v = (x + state.groundOffset * 0.3) / 40;
        const y = 40 + Math.sin(v) * 10 + Math.sin(v * 2.7) * 5;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Ground with scrolling dashes.
      ctx.strokeStyle = colors.ground;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 0.5);
      ctx.lineTo(WIDTH, GROUND_Y + 0.5);
      ctx.stroke();
      ctx.beginPath();
      for (let x = -(state.groundOffset % 24); x < WIDTH; x += 24) {
        ctx.moveTo(x, GROUND_Y + 8.5);
        ctx.lineTo(x + 8, GROUND_Y + 8.5);
      }
      ctx.stroke();

      for (const o of state.obstacles) {
        if (o.kind === 'bell') {
          drawBell(ctx, o, colors.bell);
        } else {
          drawPod(ctx, o, colors.podStroke, colors.podFill);
        }
      }

      // Grot faces left in the source SVG, flip it so it runs towards the obstacles.
      const img = grotImage.current;
      if (img?.complete) {
        const onGround = state.grotY >= GROUND_Y - GROT_H - 0.5;
        const bob = phaseRef.current === 'running' && onGround ? Math.abs(Math.sin(state.elapsedMs / 70)) * 2 : 0;
        ctx.save();
        ctx.translate(GROT_X + GROT_W, state.grotY - bob);
        ctx.scale(-1, 1);
        if (phaseRef.current === 'crashed') {
          ctx.globalAlpha = 0.6;
        }
        ctx.drawImage(img, 0, 0, GROT_W, GROT_H);
        ctx.restore();
      }

      ctx.fillStyle = colors.text;
      ctx.font = `${theme.typography.bodySmall.fontSize} ${theme.typography.fontFamilyMonospace}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(state.elapsedMs)} ms`, WIDTH - 8, 16);
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const state = stateRef.current;

      if (phaseRef.current === 'running' && !loadingDone) {
        state.elapsedMs += dt * 1000;
        state.speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * dt);
        state.groundOffset += state.speed * dt;

        state.velocityY += GRAVITY * dt;
        state.grotY = Math.min(GROUND_Y - GROT_H, state.grotY + state.velocityY * dt);
        if (state.grotY >= GROUND_Y - GROT_H) {
          state.velocityY = 0;
        }

        for (const o of state.obstacles) {
          o.x -= state.speed * dt;
        }
        state.obstacles = state.obstacles.filter((o) => o.x + o.w > -10);

        state.nextSpawnIn -= dt;
        if (state.nextSpawnIn <= 0) {
          state.obstacles.push(spawnObstacle());
          // Gaps shrink in time but not below what a jump can clear at the current speed.
          const minGap = 0.55 + 120 / state.speed;
          state.nextSpawnIn = minGap + Math.random() * 1.1;
        }

        if (state.obstacles.some((o) => overlaps(state, o))) {
          const score = Math.floor(state.elapsedMs);
          setLastScore(score);
          setBest((prev) => {
            if (score > prev) {
              writeBest(score);
              return score;
            }
            return prev;
          });
          updatePhase('crashed');
        }
      }

      draw();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [theme, loadingDone, updatePhase]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
      e.preventDefault();
      jump();
    }
  };

  const finalScore = phase === 'crashed' ? lastScore : Math.floor(stateRef.current.elapsedMs);

  return (
    <div className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={jump}
        aria-label={t('grot-loading-game.canvas-label', 'Grot runner game. Press space to jump.')}
      />
      {loadingDone ? (
        <div className={styles.overlay}>
          <Stack direction="column" alignItems="center" gap={1}>
            <Text weight="medium">{readyLabel}</Text>
            <Text color="secondary" variant="bodySmall">
              {t('grot-loading-game.final-score', 'You kept Grot alive for {{score}} ms', { score: finalScore })}
            </Text>
            <Button size="sm" onClick={onContinue} autoFocus>
              {t('grot-loading-game.continue', 'Continue')}
            </Button>
          </Stack>
        </div>
      ) : (
        <div className={styles.hint}>
          <Text color="secondary" variant="bodySmall">
            {phase === 'idle' && t('grot-loading-game.start-hint', 'Press space or tap to start')}
            {phase === 'running' && t('grot-loading-game.running-hint', 'Jump over alerts and broken pods')}
            {phase === 'crashed' &&
              t('grot-loading-game.crashed-hint', 'Ouch, {{score}} ms. Space to try again', { score: lastScore })}
          </Text>
          {best > 0 && (
            <Text color="secondary" variant="bodySmall">
              {t('grot-loading-game.best', 'Best {{best}} ms', { best })}
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    maxWidth: WIDTH,
  }),
  canvas: css({
    display: 'block',
    width: '100%',
    aspectRatio: `${WIDTH} / ${HEIGHT}`,
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
    },
  }),
  hint: css({
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 0.5, 0),
  }),
  overlay: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: colorManipulator.alpha(theme.colors.background.primary, 0.92),
    borderRadius: theme.shape.radius.default,
  }),
});
