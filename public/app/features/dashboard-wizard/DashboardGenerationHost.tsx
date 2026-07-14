import { css, keyframes } from '@emotion/css';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction, usePluginComponent } from '@grafana/runtime';
import { Button, Icon, IconButton, Portal, Spinner, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import {
  clearDashboardGeneration,
  completeDashboardGeneration,
  getDashboardGenerationPhase,
  subscribeToDashboardGeneration,
  type DashboardGenerationOutcome,
  type DashboardGenerationRequest,
} from './generationState';

const BUILDER_COMPONENT_ID = 'grafana-assistant-app/headless-dashboard-builder/v0';

/** How many progress steps the overlay keeps visible at once. */
const MAX_VISIBLE_STEPS = 5;

/** Props contract of the assistant plugin's exposed headless builder component. */
interface HeadlessDashboardBuilderProps {
  /** Omitted while prewarming; the build starts once it is set. */
  buildPrompt?: string;
  origin?: string;
  /** 'new' (default) builds a fresh dashboard; 'current' improves the open one. */
  target?: 'new' | 'current';
  onStatus?: (status: string) => void;
  onComplete?: (summary: string, controls?: { openInAssistant?: () => void }) => void;
  onError?: (error: string) => void;
}

/**
 * App-level host for the dashboard wizard's headless generation. While a
 * generation is pending it mounts the assistant plugin's invisible headless
 * builder — whose agent builds directly in the live editor scene, without
 * opening the assistant panel — behind a translucent overlay. The overlay
 * blocks all interaction but lets the user watch the dashboard take shape
 * underneath; when the build finishes, the overlay gives way to a success
 * bar offering follow-ups (continue refining in the assistant, rate the
 * result), leaving the finished dashboard in the editor — dirty and unsaved
 * — for the user to review and save.
 *
 * During the wizard's prewarm phase the builder is mounted without a prompt,
 * which lets the assistant pre-create the chat session the build will use.
 * The builder element stays in the same tree position across the prewarm →
 * active transition so React updates it in place rather than remounting.
 */
export function DashboardGenerationHost() {
  const phase = useSyncExternalStore(subscribeToDashboardGeneration, getDashboardGenerationPhase);

  if (phase.status === 'idle') {
    return null;
  }

  if (phase.status === 'done') {
    return <GenerationSuccessBar outcome={phase.outcome} />;
  }

  return (
    <DashboardGenerationSurface
      origin={phase.status === 'active' ? phase.request.origin : phase.origin}
      request={phase.status === 'active' ? phase.request : null}
    />
  );
}

function DashboardGenerationSurface({
  origin,
  request,
}: {
  origin: string;
  request: DashboardGenerationRequest | null;
}) {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [steps, setSteps] = useState<string[]>([]);

  const { component: Builder, isLoading } = usePluginComponent<HeadlessDashboardBuilderProps>(BUILDER_COMPONENT_ID);

  // A missing builder only matters once the user actually asked to build;
  // during prewarm we just silently skip the warm-up.
  const builderMissing = !isLoading && !Builder && request !== null;
  useEffect(() => {
    if (builderMissing) {
      notifyApp.error(
        t('dashboard-wizard.generation.failed-title', 'Dashboard generation failed'),
        t('dashboard-wizard.generation.assistant-unavailable', 'The Grafana Assistant is not available.')
      );
      clearDashboardGeneration();
    }
  }, [builderMissing, notifyApp]);

  const handleStatus = (status: string) => {
    setSteps((prev) => (prev[prev.length - 1] === status ? prev : [...prev, status]));
  };

  // By completion the finished dashboard is already open in the editor (for
  // fresh builds the agent navigated there itself), so the host swaps the
  // overlay for the follow-up success bar.
  const handleComplete = (summary: string, controls?: { openInAssistant?: () => void }) => {
    if (request === null) {
      return;
    }
    completeDashboardGeneration({
      summary,
      origin: request.origin,
      target: request.target,
      openInAssistant: controls?.openInAssistant,
    });
  };

  const handleError = (error: string) => {
    notifyApp.error(t('dashboard-wizard.generation.failed-title', 'Dashboard generation failed'), error);
    clearDashboardGeneration();
  };

  return (
    <>
      {Builder && (
        <Builder
          buildPrompt={request?.prompt}
          origin={origin}
          target={request?.target}
          onStatus={handleStatus}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
      {request !== null && <GenerationOverlay styles={styles} steps={steps} target={request.target} />}
    </>
  );
}

function GenerationOverlay({
  styles,
  steps,
  target,
}: {
  styles: ReturnType<typeof getStyles>;
  steps: string[];
  target: 'new' | 'current';
}) {
  const visibleSteps =
    steps.length > 0
      ? steps.slice(-MAX_VISIBLE_STEPS)
      : [
          target === 'current'
            ? t('dashboard-wizard.generation.starting-improve', 'Reading your dashboard')
            : t('dashboard-wizard.generation.starting', 'Reading your data sources'),
        ];

  return (
    // The agent builds into the live scene behind this overlay. The overlay
    // is translucent so the user can watch panels appear underneath, but it
    // captures all pointer interaction until the build finishes.
    <Portal>
      <div className={styles.overlay}>
        <div className={styles.content}>
          <div className={styles.logo}>
            <div className={styles.logoSpinner} />
            <div className={styles.logoBadge}>
              <Icon name="ai-sparkle" size="xl" />
            </div>
          </div>

          <h2 className={styles.title}>
            {target === 'current'
              ? t('dashboard-wizard.generation.title-improve', 'Improving your dashboard')
              : t('dashboard-wizard.generation.title', 'Building your dashboard')}
          </h2>
          <p className={styles.subtitle}>
            {t('dashboard-wizard.generation.subtitle', 'This usually takes a few seconds. Hang tight.')}
          </p>

          <ul className={styles.steps}>
            {visibleSteps.map((step, index) => {
              const isActive = index === visibleSteps.length - 1;
              return (
                <li key={`${index}-${step}`} className={styles.step}>
                  <span className={styles.stepIndicator}>
                    {isActive ? (
                      <Spinner inline size="sm" />
                    ) : (
                      <Icon name="check" className={styles.stepCheck} size="sm" />
                    )}
                  </span>
                  <span className={isActive ? styles.stepActiveText : styles.stepDoneText}>{step}</span>
                </li>
              );
            })}
          </ul>

          <div className={styles.tipCard}>
            <span className={styles.tipIcon}>
              <Icon name="lightbulb-alt" size="lg" />
            </span>
            <div>
              <div className={styles.tipTitle}>
                {t('dashboard-wizard.generation.tip-title', 'About Grafana Assistant')}
              </div>
              <div className={styles.tipBody}>
                {t(
                  'dashboard-wizard.generation.tip-body',
                  'The Assistant checks which metrics and labels actually exist in your data sources, so every panel is built from real data.'
                )}
              </div>
            </div>
          </div>

          {/* Unmounting the builder cancels the run on the assistant side. */}
          <Button size="sm" variant="secondary" fill="text" onClick={clearDashboardGeneration}>
            {t('dashboard-wizard.generation.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </Portal>
  );
}

/**
 * Post-build follow-up bar: the finished dashboard sits in the editor
 * underneath, and this floating card offers to continue refining the same
 * conversation in the assistant sidebar and to rate the result.
 */
function GenerationSuccessBar({ outcome }: { outcome: DashboardGenerationOutcome }) {
  const styles = useStyles2(getStyles);
  const [rating, setRating] = useState<'positive' | 'negative'>();

  const handleRate = (value: 'positive' | 'negative') => {
    setRating(value);
    reportInteraction('dashboard_wizard_rated', { rating: value, target: outcome.target });
  };

  const handleContinue = () => {
    outcome.openInAssistant?.();
    clearDashboardGeneration();
  };

  return (
    <Portal>
      <div className={styles.successBar}>
        <span className={styles.successIcon}>
          <Icon name="ai-sparkle" size="lg" />
        </span>
        <div className={styles.successBody}>
          <div className={styles.successTitle}>
            {outcome.target === 'current'
              ? t('dashboard-wizard.generation.success-title-improve', 'Dashboard improved')
              : t('dashboard-wizard.generation.success-title', 'Dashboard generated')}
          </div>
          {outcome.summary !== '' && <div className={styles.successSummary}>{outcome.summary}</div>}
          <div className={styles.successActions}>
            {outcome.openInAssistant && (
              <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={handleContinue}>
                {t('dashboard-wizard.generation.continue-in-assistant', 'Continue in Assistant')}
              </Button>
            )}
            <span className={styles.successRating}>
              {rating === undefined ? (
                <>
                  <IconButton
                    name="thumbs-up"
                    tooltip={t('dashboard-wizard.generation.rate-up', 'Good result')}
                    onClick={() => handleRate('positive')}
                  />
                  <IconButton
                    name="thumbs-down"
                    tooltip={t('dashboard-wizard.generation.rate-down', 'Poor result')}
                    onClick={() => handleRate('negative')}
                  />
                </>
              ) : (
                <span className={styles.ratingThanks}>
                  {t('dashboard-wizard.generation.rate-thanks', 'Thanks for the feedback!')}
                </span>
              )}
            </span>
          </div>
        </div>
        <IconButton
          name="times"
          tooltip={t('dashboard-wizard.generation.dismiss', 'Dismiss')}
          onClick={clearDashboardGeneration}
        />
      </div>
    </Portal>
  );
}

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideUp = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

function getStyles(theme: GrafanaTheme2) {
  const ringMask = 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))';

  return {
    overlay: css({
      position: 'fixed',
      inset: 0,
      zIndex: theme.zIndex.modal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Translucent: the page (and, on completion, the editor) stays visible
      // underneath, but the overlay still intercepts every pointer event.
      background: colorManipulator.alpha(theme.colors.background.canvas, 0.8),
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${fadeIn} 150ms ease-out`,
      },
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
      width: '100%',
      maxWidth: '440px',
      padding: theme.spacing(3),
    }),
    logo: css({
      position: 'relative',
      width: '104px',
      height: '104px',
      borderRadius: theme.shape.radius.circle,
      border: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    logoSpinner: css({
      position: 'absolute',
      inset: theme.spacing(1),
      borderRadius: theme.shape.radius.circle,
      background: 'conic-gradient(from 0deg, transparent, #f55f3e, #f5b73d, #6ccf8e, #64b6f7, #8e7cff, transparent)',
      mask: ringMask,
      WebkitMask: ringMask,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${spin} 2.5s linear infinite`,
      },
    }),
    logoBadge: css({
      width: '64px',
      height: '64px',
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.background.secondary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.primary,
    }),
    title: css({
      margin: 0,
      textAlign: 'center',
    }),
    subtitle: css({
      margin: 0,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    }),
    steps: css({
      listStyle: 'none',
      margin: theme.spacing(1, 0, 0),
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      width: '100%',
      maxWidth: '360px',
    }),
    step: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      minWidth: 0,
    }),
    stepIndicator: css({
      flexShrink: 0,
      width: theme.spacing(2),
      display: 'flex',
      justifyContent: 'center',
    }),
    stepCheck: css({
      color: theme.colors.success.text,
    }),
    stepDoneText: css({
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    stepActiveText: css({
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    tipCard: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(2),
      width: '100%',
      marginTop: theme.spacing(2),
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    tipIcon: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(4),
      height: theme.spacing(4),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.canvas,
      color: theme.colors.warning.text,
    }),
    tipTitle: css({
      color: theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: theme.spacing(0.5),
    }),
    tipBody: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    successBar: css({
      position: 'fixed',
      right: theme.spacing(3),
      bottom: theme.spacing(3),
      zIndex: theme.zIndex.portal,
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      width: '100%',
      maxWidth: '420px',
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${slideUp} 150ms ease-out`,
      },
    }),
    successIcon: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(4),
      height: theme.spacing(4),
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.background.secondary,
      color: theme.colors.success.text,
    }),
    successBody: css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    successTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    successSummary: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    }),
    successActions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginTop: theme.spacing(0.5),
    }),
    successRating: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      marginLeft: 'auto',
    }),
    ratingThanks: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
