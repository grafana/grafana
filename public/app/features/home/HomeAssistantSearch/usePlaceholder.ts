import { useEffect, useMemo, useRef, useState } from 'react';

const PLACEHOLDER_PAUSE_MS = 4000;
const PLACEHOLDER_TYPE_MS = 40;

type Phase = 'pausing' | 'deleting' | 'typing';

/**
 * Animated placeholder that cycles through prompts with a typing effect.
 * Returns [inputRef, currentFullString, initialPlaceholder].
 *
 * Ported from grafana-setupguide-app — imperative animation loop that
 * runs entirely inside a single useEffect (no React state per tick).
 */
export function usePlaceholder(
  value?: string | string[]
): readonly [React.RefObject<HTMLInputElement>, string, string] {
  const options = useMemo(() => (Array.isArray(value) ? value : [value]), [value]);
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
          // Compute common prefix length for the next transition
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
