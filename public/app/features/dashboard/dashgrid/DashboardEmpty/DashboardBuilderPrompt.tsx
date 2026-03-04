import { css, cx, keyframes } from '@emotion/css';
import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { useAssistant, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';

const EXAMPLE_PROMPTS = [
  'Monitor Kubernetes cluster CPU, memory, and pod health',
  'Track API response times, error rates, and throughput',
  'Show database connection pool usage and query latency',
  'Infrastructure overview with disk, network, and alerts',
  'Application performance with RED metrics and SLOs',
];

const TYPING_SPEED_MS = 45;
const DELETING_SPEED_MS = 25;
const PAUSE_AFTER_TYPING_MS = 2400;
const PAUSE_AFTER_DELETING_MS = 400;

interface DashboardBuilderPromptProps {
  onAddPanel: () => void;
  onPreviewTemplates?: () => void;
  onImportDashboard?: () => void;
  datasourceUid?: string | null;
}

export function DashboardBuilderPrompt({
  onAddPanel,
  onPreviewTemplates,
  onImportDashboard,
  datasourceUid,
}: DashboardBuilderPromptProps) {
  const { isAvailable, openAssistant } = useAssistant();
  const styles = useStyles2(getStyles);
  const [inputValue, setInputValue] = useState('');
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userHasTyped = inputValue.length > 0;

  useEffect(() => {
    if (isFocused || userHasTyped) {
      return;
    }

    let promptIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function tick() {
      const currentPrompt = EXAMPLE_PROMPTS[promptIndex];

      if (!isDeleting) {
        charIndex++;
        setAnimatedPlaceholder(currentPrompt.slice(0, charIndex));

        if (charIndex === currentPrompt.length) {
          isDeleting = true;
          animationRef.current = setTimeout(tick, PAUSE_AFTER_TYPING_MS);
          return;
        }
        animationRef.current = setTimeout(tick, TYPING_SPEED_MS);
      } else {
        charIndex--;
        setAnimatedPlaceholder(currentPrompt.slice(0, charIndex));

        if (charIndex === 0) {
          isDeleting = false;
          promptIndex = (promptIndex + 1) % EXAMPLE_PROMPTS.length;
          animationRef.current = setTimeout(tick, PAUSE_AFTER_DELETING_MS);
          return;
        }
        animationRef.current = setTimeout(tick, DELETING_SPEED_MS);
      }
    }

    animationRef.current = setTimeout(tick, PAUSE_AFTER_DELETING_MS);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isFocused, userHasTyped]);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!inputValue.trim() || !openAssistant) {
        return;
      }

      const prompt = inputValue.trim();
      setSubmittedPrompt(prompt);
      setHasSubmitted(true);

      const context = datasourceUid ? [createAssistantContextItem('datasource', { datasourceUid })] : undefined;

      openAssistant({
        origin: 'dashboard/empty/ai-builder',
        prompt,
        context,
        autoSend: true,
        mode: 'dashboarding',
      });
    },
    [inputValue, openAssistant, datasourceUid]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!openAssistant) {
        return;
      }

      setSubmittedPrompt(suggestion);
      setHasSubmitted(true);

      const context = datasourceUid ? [createAssistantContextItem('datasource', { datasourceUid })] : undefined;

      openAssistant({
        origin: 'dashboard/empty/ai-builder',
        prompt: suggestion,
        context,
        autoSend: true,
        mode: 'dashboarding',
      });
    },
    [openAssistant, datasourceUid]
  );

  if (!isAvailable || !openAssistant) {
    return null;
  }

  if (hasSubmitted) {
    return (
      <div className={styles.container}>
        <div className={styles.buildingState}>
          <div className={styles.buildingIconArea}>
            <div className={styles.orbitRing} />
            <div className={styles.orbitRingDelayed} />
            <Icon name="ai-sparkle" size="xxxl" className={styles.buildingSparkle} />
          </div>
          <h2 className={styles.buildingTitle}>
            <Trans i18nKey="dashboard.ai-builder.building-title">Building your dashboard</Trans>
          </h2>
          <p className={styles.buildingPromptText}>&ldquo;{submittedPrompt}&rdquo;</p>
          <div className={styles.buildingDots}>
            <span className={styles.buildingDot} />
            <span className={cx(styles.buildingDot, styles.buildingDotDelayed1)} />
            <span className={cx(styles.buildingDot, styles.buildingDotDelayed2)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.iconWrapper}>
          <Icon name="ai-sparkle" size="xxxl" className={styles.sparkleIcon} />
        </div>
        <h1 className={styles.title}>
          <Trans i18nKey="dashboard.ai-builder.title">What would you like to monitor?</Trans>
        </h1>
        <p className={styles.subtitle}>
          <Trans i18nKey="dashboard.ai-builder.subtitle">
            Describe your dashboard and Grafana Assistant will build it for you
          </Trans>
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.inputSection}>
        <div className={cx(styles.inputContainer, isFocused && styles.inputContainerFocused)}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={
              isFocused
                ? t('dashboard.ai-builder.input-placeholder', 'Describe the dashboard you want...')
                : animatedPlaceholder
            }
            rows={1}
          />
          <IconButton
            name="arrow-right"
            aria-label={t('dashboard.ai-builder.submit-label', 'Build dashboard')}
            className={cx(styles.submitButton, inputValue.trim() && styles.submitButtonActive)}
            size="lg"
            type="submit"
            disabled={!inputValue.trim()}
          />
        </div>
      </form>

      <div className={styles.suggestions}>
        <span className={styles.suggestionsLabel}>
          <Trans i18nKey="dashboard.ai-builder.suggestions-label">Try:</Trans>
        </span>
        {EXAMPLE_PROMPTS.slice(0, 3).map((suggestion) => (
          <button key={suggestion} className={styles.suggestionChip} onClick={() => handleSuggestionClick(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerText}>
          <Trans i18nKey="dashboard.ai-builder.divider-text">or start manually</Trans>
        </span>
        <div className={styles.dividerLine} />
      </div>

      <div className={styles.actions}>
        <button className={styles.actionCard} onClick={onAddPanel}>
          <Icon name="graph-bar" size="xl" className={styles.actionIcon} />
          <span className={styles.actionTitle}>
            <Trans i18nKey="dashboard.ai-builder.add-panel-title">Add a panel</Trans>
          </span>
          <span className={styles.actionDescription}>
            <Trans i18nKey="dashboard.ai-builder.add-panel-description">
              Pick a visualization and configure queries
            </Trans>
          </span>
        </button>

        {onPreviewTemplates && (
          <button className={styles.actionCard} onClick={onPreviewTemplates}>
            <Icon name="apps" size="xl" className={styles.actionIcon} />
            <span className={styles.actionTitle}>
              <Trans i18nKey="dashboard.ai-builder.preview-templates-title">Preview templates</Trans>
            </span>
            <span className={styles.actionDescription}>
              <Trans i18nKey="dashboard.ai-builder.preview-templates-description">
                Start from industry best-practice layouts
              </Trans>
            </span>
          </button>
        )}

        {onImportDashboard && (
          <button className={styles.actionCard} onClick={onImportDashboard}>
            <Icon name="upload" size="xl" className={styles.actionIcon} />
            <span className={styles.actionTitle}>
              <Trans i18nKey="dashboard.ai-builder.import-dashboard-title">Import a dashboard</Trans>
            </span>
            <span className={styles.actionDescription}>
              <Trans i18nKey="dashboard.ai-builder.import-dashboard-description">
                Import from a file or grafana.com
              </Trans>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

const GLOW_GRADIENT =
  'linear-gradient(45deg, oklab(0.87 -0.01 0.21), oklab(0.73 0.13 0.17), oklab(0.65 0.2 0.14), oklab(0.64 0.28 0.01), oklab(0.65 0.27 -0.16), oklab(0.49 0.04 -0.3), oklab(0.54 0.12 -0.28))';

function getGlowShadow(theme: GrafanaTheme2) {
  const baseShadow = theme.isDark ? 'rgb(17 18 23)' : 'rgb(245 245 245)';
  return [
    'rgba(168, 85, 247, 0.2) 3px -1px 20px',
    'rgba(249, 115, 22, 0.15) -5px 3px 40px',
    'rgba(168, 85, 247, 0.1) 7px 4px 60px',
    'rgba(249, 115, 22, 0.05) -6px -6px 80px',
    'rgba(168, 85, 247, 0.1) -1px 7px 100px',
    'rgba(249, 115, 22, 0.03) -5px 0px 120px',
    `${baseShadow} 1px 0px 20px`,
  ].join(', ');
}

function getStyles(theme: GrafanaTheme2) {
  const elevatedBg = theme.colors.background.elevated;
  const glowShadow = getGlowShadow(theme);

  const fadeIn = keyframes({
    from: { opacity: 0, transform: 'translateY(12px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  });

  const pulse = keyframes({
    '0%, 100%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.15)', opacity: 0.85 },
  });

  const orbit = keyframes({
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  });

  const dotBounce = keyframes({
    '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
    '40%': { transform: 'scale(1)', opacity: 1 },
  });

  const shimmer = keyframes({
    '0%': { backgroundPosition: '-200% center' },
    '100%': { backgroundPosition: '200% center' },
  });

  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(4),
      padding: theme.spacing(4, 2),
      maxWidth: 720,
      margin: '0 auto',
      width: '100%',
    }),

    hero: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      textAlign: 'center',
    }),

    iconWrapper: css({
      marginBottom: theme.spacing(1),
    }),

    sparkleIcon: css({
      color: theme.colors.warning.text,
    }),

    title: css({
      ...theme.typography.h2,
      margin: 0,
      color: theme.colors.text.primary,
    }),

    subtitle: css({
      ...theme.typography.body,
      margin: 0,
      color: theme.colors.text.secondary,
    }),

    inputSection: css({
      width: '100%',
    }),

    inputContainer: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      borderRadius: theme.shape.radius.pill,
      border: '2px solid transparent',
      background: `linear-gradient(${elevatedBg}, ${elevatedBg}) padding-box, ${GLOW_GRADIENT} border-box`,
      boxShadow: glowShadow,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'box-shadow 0.3s ease',
      },
    }),

    inputContainerFocused: css({
      boxShadow: [
        'rgba(168, 85, 247, 0.35) 3px -1px 25px',
        'rgba(249, 115, 22, 0.25) -5px 3px 45px',
        'rgba(168, 85, 247, 0.2) 7px 4px 65px',
        'rgba(249, 115, 22, 0.1) -6px -6px 85px',
        'rgba(168, 85, 247, 0.2) -1px 7px 105px',
        'rgba(249, 115, 22, 0.06) -5px 0px 125px',
        `${theme.isDark ? 'rgb(17 18 23)' : 'rgb(245 245 245)'} 1px 0px 20px`,
      ].join(', '),
    }),

    input: css({
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      padding: theme.spacing(2, 2),
      paddingRight: theme.spacing(6),
      ...theme.typography.body,
      color: theme.colors.text.primary,
      resize: 'none',
      fontFamily: theme.typography.fontFamily,

      '&::placeholder': {
        color: theme.colors.text.disabled,
      },
    }),

    submitButton: css({
      position: 'absolute',
      right: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      opacity: 0.4,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.2s ease',
      },
    }),

    submitButtonActive: css({
      opacity: 1,
    }),

    suggestions: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      justifyContent: 'center',
      alignItems: 'center',
    }),

    suggestionsLabel: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
    }),

    suggestionChip: css({
      ...theme.typography.bodySmall,
      padding: theme.spacing(0.5, 1.5),
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.15s ease',
      },

      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
        borderColor: theme.colors.border.medium,
      },
    }),

    divider: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      width: '100%',
    }),

    dividerLine: css({
      flex: 1,
      height: 1,
      background: theme.colors.border.weak,
    }),

    dividerText: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.disabled,
      whiteSpace: 'nowrap',
    }),

    actions: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: theme.spacing(2),
      width: '100%',
    }),

    actionCard: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(3),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'all 0.15s ease',
      },
      textAlign: 'center',

      '&:hover': {
        background: theme.colors.action.hover,
        borderColor: theme.colors.border.medium,
      },
    }),

    actionIcon: css({
      color: theme.colors.text.secondary,
    }),

    actionTitle: css({
      ...theme.typography.body,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),

    actionDescription: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
    }),

    buildingState: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(3),
      padding: theme.spacing(6, 2),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${fadeIn} 0.5s ease-out`,
      },
    }),

    buildingIconArea: css({
      position: 'relative',
      width: 80,
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    buildingSparkle: css({
      color: theme.colors.warning.text,
      zIndex: 1,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${pulse} 2.4s ease-in-out infinite`,
      },
    }),

    orbitRing: css({
      position: 'absolute',
      inset: -8,
      borderRadius: theme.shape.radius.circle,
      border: '2px solid transparent',
      borderTopColor: 'rgba(168, 85, 247, 0.5)',
      borderRightColor: 'rgba(249, 115, 22, 0.3)',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${orbit} 3s linear infinite`,
      },
    }),

    orbitRingDelayed: css({
      position: 'absolute',
      inset: -16,
      borderRadius: theme.shape.radius.circle,
      border: '1.5px solid transparent',
      borderBottomColor: 'rgba(249, 115, 22, 0.4)',
      borderLeftColor: 'rgba(168, 85, 247, 0.2)',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${orbit} 5s linear infinite reverse`,
      },
    }),

    buildingTitle: css({
      ...theme.typography.h3,
      margin: 0,
      background: `linear-gradient(90deg, ${theme.colors.text.primary} 40%, rgba(168, 85, 247, 0.8) 50%, ${theme.colors.text.primary} 60%)`,
      backgroundSize: '200% auto',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${shimmer} 3s linear infinite`,
      },
    }),

    buildingPromptText: css({
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      maxWidth: 480,
      fontStyle: 'italic',
      lineHeight: 1.6,
    }),

    buildingDots: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginTop: theme.spacing(1),
    }),

    buildingDot: css({
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
      background: GLOW_GRADIENT,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${dotBounce} 1.4s ease-in-out infinite`,
      },
    }),

    buildingDotDelayed1: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animationDelay: '0.16s',
      },
    }),

    buildingDotDelayed2: css({
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animationDelay: '0.32s',
      },
    }),
  };
}
