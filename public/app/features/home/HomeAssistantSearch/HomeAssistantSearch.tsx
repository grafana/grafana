import { css, cx, keyframes } from '@emotion/css';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAssistant, useLimits, useTerms } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { acceptAssistantTerms } from './acceptTerms';
import { usePlaceholder } from './usePlaceholder';

const LOADING_ARTIFICIAL_MS = 1000;

export function HomeAssistantSearch() {
  const styles = useStyles2(getStyles);
  const { isAvailable, openAssistant } = useAssistant();
  const { accepted, termsType, loading: termsLoading, error: termsError } = useTerms();
  const { isLimitReached } = useLimits();
  const admin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  const needsAutoAccept = termsType === 'msa' && !accepted && !termsError && !termsLoading && !isLimitReached && admin;

  const examples = useMemo(
    () => [
      t('home.assistant.example.create-dashboard', 'How do I create a dashboard?'),
      t('home.assistant.example.promql', 'Explain this PromQL query'),
      t('home.assistant.example.alerts-firing', 'What alerts are firing right now?'),
      t('home.assistant.example.errors', 'Show me errors from the last hour'),
      t('home.assistant.example.data-source', 'How do I set up a data source?'),
      t('home.assistant.example.loki-query', 'Help me write a Loki query'),
    ],
    []
  );

  const placeholderLimit = t(
    'home.assistant.placeholder-limit',
    "You've hit the monthly limit for Assistant... Upgrade to keep going!"
  );

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputRef, placeholderCurrent, placeholderInitial] = usePlaceholder(
    isLimitReached ? placeholderLimit : examples
  );

  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const submit = useCallback(
    async (prompt: string) => {
      setLoading(true);
      setInput(prompt);

      // Blur so user doesn't accidentally double-submit
      if (document.activeElement instanceof HTMLElement && formRef.current?.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      try {
        if (needsAutoAccept) {
          await acceptAssistantTerms();
        }
        reportInteraction('grafana_home_assistant_submit', {
          promptLength: prompt.length,
          autoAcceptedTerms: needsAutoAccept,
        });
        openAssistant?.({ origin: 'grafana/home', prompt, autoSend: true });
      } finally {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setLoading(false);
          setInput('');
        }, LOADING_ARTIFICIAL_MS);
      }
    },
    [needsAutoAccept, openAssistant]
  );

  if (!isAvailable || !openAssistant) {
    return null;
  }

  // Non-admin where MSA terms are unaccepted — can't accept on behalf of org
  if (termsType === 'msa' && !accepted && !admin) {
    return null;
  }

  // Use the animated placeholder as default prompt when input is empty
  const prompt = input || placeholderCurrent;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt && !loading && !isLimitReached) {
      submit(prompt);
    }
  };

  return (
    <form onSubmit={onSubmit} ref={formRef} className={styles.form}>
      <div className={cx(styles.wrapper, { [styles.limit]: isLimitReached })}>
        <Input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder={placeholderInitial}
          ref={inputRef}
          aria-label={
            isLimitReached
              ? placeholderLimit
              : t('home.assistant.placeholder-default', 'Ask Assistant anything about Grafana...')
          }
          prefix={<Icon name="ai-sparkle" size="xl" className={styles.icon} />}
          suffix={
            isLimitReached && admin ? (
              <LinkButton
                href="https://grafana.com/products/cloud/"
                target="_blank"
                rel="noreferrer"
                onClick={() => reportInteraction('grafana_home_assistant_upgrade_click', {})}
              >
                <Trans i18nKey="home.assistant.upgrade">Upgrade</Trans>
              </LinkButton>
            ) : (
              <Button
                type="submit"
                icon={loading ? 'spinner' : 'message'}
                title={t('home.assistant.ask-aria-label', 'Ask Assistant')}
                aria-label={t('home.assistant.ask-aria-label', 'Ask Assistant')}
                disabled={!prompt || loading || isLimitReached}
              />
            )
          }
          disabled={loading || isLimitReached}
          className={styles.input}
        />
      </div>

      {needsAutoAccept && (
        <p className={styles.disclaimer}>
          <Trans i18nKey="home.assistant.auto-accept-disclaimer">
            By using Grafana Assistant, you will be enabling this AI Feature for all users on your instance.
          </Trans>
        </p>
      )}
    </form>
  );
}

// Sliding gradient: the pseudo-element is 200% wide and translates left→right,
// giving a seamless scrolling border on all four sides.
const gradientShift = keyframes({
  '0%': { transform: 'translateX(-50%) translateZ(0)' },
  '100%': { transform: 'translateX(0%) translateZ(0)' },
});

const getStyles = (theme: GrafanaTheme2) => {
  const orange = theme.visualization.getColorByName('semi-dark-orange');
  const purple = theme.visualization.getColorByName('dark-purple');
  const gradient = [orange, purple];
  const colors = [...gradient, ...gradient, gradient[0]].join(', ');
  const colorsEnhanced = [...gradient, ...gradient, gradient[0]]
    .map((color) => `oklch(from ${color} l calc(c * 1.25) h)`)
    .join(', ');

  return {
    form: css({
      width: '100%',
      overflow: 'hidden',
    }),
    wrapper: css({
      position: 'relative',
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.25),
      isolation: 'isolate',
      '&::before': {
        content: '""',
        zIndex: -1,
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: '350%',
        height: '100%',
        background: `linear-gradient(90deg, ${colors})`,
        '@supports (color: oklch(from white l c h))': {
          background: `linear-gradient(90deg, ${colorsEnhanced})`,
        },
        [theme.transitions.handleMotion('no-preference')]: {
          transition: 'background 0.2s linear',
          willChange: 'transform',
          animation: `${gradientShift} 3s linear infinite`,
          width: '200%',
          backfaceVisibility: 'hidden',
        },
      },
      '&:focus-within::before': {
        background: theme.colors.primary.border,
        [theme.transitions.handleMotion('no-preference')]: {
          animationPlayState: 'paused',
        },
      },
    }),
    limit: css({
      '&::before': {
        opacity: 0.5,
      },
    }),
    input: css({
      height: theme.spacing(6),
      'div:has(> svg)': {
        pointerEvents: 'none',
      },
      input: {
        padding: `0 ${theme.spacing(2)}`,
        '&, &:focus': {
          outline: 'none',
          boxShadow: 'none',
        },
        '&, &:disabled': {
          background: theme.colors.background.canvas,
        },
        '&:disabled': {
          '&, &:hover': {
            border: '1px solid transparent',
          },
        },
      },
    }),
    icon: css({
      color: theme.colors.warning.main,
      margin: `0 ${theme.spacing(0.5)}`,
      pointerEvents: 'none',
    }),
    disclaimer: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      margin: theme.spacing(0.5),
    }),
  };
};
