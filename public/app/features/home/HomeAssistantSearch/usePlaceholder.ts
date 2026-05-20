import { useEffect, useMemo, useRef, useState } from 'react';

import { t } from '@grafana/i18n';

const PLACEHOLDER_PAUSE_MS = 4000;
const PLACEHOLDER_TYPE_MS = 40;

type Phase = 'pausing' | 'deleting' | 'typing';

function getExamples() {
  return [
    t('home.assistant.example.create-dashboard', 'How do I create a dashboard?'),
    t('home.assistant.example.promql', 'Explain this PromQL query'),
    t('home.assistant.example.alerts-firing', 'What alerts are firing right now?'),
    t('home.assistant.example.errors', 'Show me errors from the last hour'),
    t('home.assistant.example.data-source', 'How do I set up a data source?'),
    t('home.assistant.example.loki-query', 'Help me write a Loki query'),
  ];
}

function getLimitPlaceholder() {
  return t('home.assistant.placeholder-limit', "You've hit the monthly limit for Assistant... Upgrade to keep going!");
}

/**
 * Animated placeholder that cycles through example prompts with a typing effect.
 * When the limit is reached, shows a static limit message instead.
 *
 * Ported from grafana-setupguide-app — imperative animation loop that
 * runs entirely inside a single useEffect (no React state per tick).
 */
export function usePlaceholder(isLimitReached: boolean) {
  const options = useMemo(() => (isLimitReached ? [getLimitPlaceholder()] : getExamples()), [isLimitReached]);
  const initial = options[0] ?? '';
  const [full, setFull] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setAnimated = (text: string) => {
      if (ref.current) {
        ref.current.placeholder = text;
      }
    };

    // Reset when options change
    setAnimated(initial);
    setFull(initial);

    if (options.length < 2) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    let phase: Phase = 'pausing';
    let index = 0;
    let cursor = options[0]!.length;
    let common = 0;

    const animate = () => {
      const current = options[index]!;
      const nextIndex = (index + 1) % options.length;
      const next = options[nextIndex]!;

      if (phase === 'pausing') {
        setAnimated(current);

        timeout = setTimeout(() => {
          common = 0;
          while (common < current.length && common < next.length && current[common] === next[common]) {
            common++;
          }
          phase = 'deleting';
          animate();
        }, PLACEHOLDER_PAUSE_MS);
        return;
      }

      if (phase === 'deleting') {
        if (cursor > common) {
          cursor--;
          setAnimated(current.slice(0, cursor) + '|');
          timeout = setTimeout(animate, PLACEHOLDER_TYPE_MS);
          return;
        }

        phase = 'typing';
        index = nextIndex;
        setFull(next);
        animate();
        return;
      }

      if (phase === 'typing') {
        if (cursor <= current.length) {
          setAnimated(current.slice(0, cursor) + '|');
          cursor++;
          timeout = setTimeout(animate, PLACEHOLDER_TYPE_MS);
          return;
        }

        phase = 'pausing';
        animate();
        return;
      }
    };

    animate();
    return () => clearTimeout(timeout);
  }, [initial, options]);

  return [ref, full, initial] as const;
}
