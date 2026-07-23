// Prototype-only: canned demo strings and a decorative fade/pulse; not i18n'd.
/* eslint-disable @grafana/i18n/no-untranslated-strings, @grafana/no-unreduced-motion, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
import { css, keyframes } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Button } from '../../Button/Button';
import { Input } from '../../Input/Input';
import { Spinner } from '../../Spinner/Spinner';

import { AssistantMark } from './AssistantMark';
import { QueryChips } from './QueryChips';
import {
  BUILD_GHOST,
  MIDQUERY_PROMQL_PREVIEW,
  MIDQUERY_QUERY,
  MIDQUERY_STAGES,
  MIDQUERY_TIPS,
  SCRATCH_FLOW,
  SCRATCH_NL,
  SCRATCH_PROMQL_PREVIEW,
  SCRATCH_QUERY,
} from './scriptedData';
import { type EditorActions, Journey } from './types';
import { useBuildingAnimation } from './useBuildingAnimation';

interface Props {
  journey: Journey;
  /** Editor operations (write/commit/clear the temporary preview). */
  actions: EditorActions;
  /** Hide the popover (no further editor changes). */
  onClose: () => void;
}

const CONSTRUCTING_MS = 900;
const BUILDING_MS = 1500;

/** Scratch / Edit phases. */
type Phase = 'input' | 'constructing' | 'building' | 'preview' | 'review';

/**
 * The caret-anchored assistant popover.
 *  - Scratch: describe → "Constructing query" → "Building flow" → the query is
 *    written into the editor as a semi-transparent preview → Accept or modify.
 *  - Edit: refine an already-generated query with the NL input.
 *  - Mid-query: recognise a partial query and suggest the completion.
 */
export function CoauthorPopover({ journey, actions, onClose }: Props) {
  const styles = useStyles2(getStyles);

  if (journey === Journey.MidQuery) {
    return <MidQueryPopover actions={actions} styles={styles} />;
  }
  return <GenerativePopover journey={journey} actions={actions} onClose={onClose} styles={styles} />;
}

type Styles = ReturnType<typeof getStyles>;

/** Scratch + Edit: the generate / preview / accept / modify loop. */
function GenerativePopover({
  journey,
  actions,
  onClose,
  styles,
}: {
  journey: Journey;
  actions: EditorActions;
  onClose: () => void;
  styles: Styles;
}) {
  const [phase, setPhase] = useState<Phase>(journey === Journey.Edit ? 'review' : 'input');
  const [nl, setNl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Drive the scripted phase timeline.
  useEffect(() => {
    if (phase === 'constructing') {
      const id = setTimeout(() => setPhase('building'), CONSTRUCTING_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'building') {
      const id = setTimeout(() => setPhase('preview'), BUILDING_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'preview') {
      // Write the query into the editor as a temporary, semi-transparent preview.
      actions.writeTemp(SCRATCH_QUERY);
    }
    return undefined;
  }, [phase, actions]);

  // Keep focus in the NL input whenever it's shown (Monaco otherwise holds it).
  useEffect(() => {
    if (phase === 'input' || phase === 'preview' || phase === 'review') {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  const accept = () => {
    if (phase === 'preview') {
      actions.commitTemp();
    }
    onClose();
  };

  const dismiss = () => {
    if (phase === 'preview') {
      actions.clearTemp();
    }
    onClose();
  };

  const submitNl = () => {
    if (!nl.trim()) {
      // Empty submit on a written query = accept.
      if (phase === 'preview' || phase === 'review') {
        accept();
      }
      return;
    }
    // A described change: clear any preview and re-run the build with it.
    if (phase === 'preview') {
      actions.clearTemp();
    }
    setNl('');
    setPhase('constructing');
  };

  const hasTemp = phase === 'preview';
  const showFlow = phase === 'building' || phase === 'preview' || phase === 'review';

  return (
    <div className={styles.popover} onKeyDown={(e) => e.key === 'Escape' && dismiss()}>
      <div className={styles.header}>
        <AssistantMark />
        <span className={styles.title}>Assistant</span>
        <span className={styles.dismiss}>esc to dismiss</span>
      </div>

      {/* Status line */}
      {phase === 'constructing' && (
        <div className={styles.status}>
          <Spinner size="sm" inline />
          Constructing query…
        </div>
      )}
      {phase === 'building' && (
        <div className={styles.status}>
          <Spinner size="sm" inline />
          Building flow…
        </div>
      )}

      {/* Visual flow */}
      {showFlow && (
        <div className={styles.flow}>
          <div className={styles.flowLabel}>{phase === 'building' ? 'Building flow' : 'Query flow'}</div>
          <QueryChips chips={phase === 'building' ? BUILD_GHOST : SCRATCH_FLOW} />
        </div>
      )}

      {/* Preview / review: PromQL + accept */}
      {(phase === 'preview' || phase === 'review') && (
        <div className={styles.suggest}>
          {hasTemp && <code className={styles.promql}>{SCRATCH_PROMQL_PREVIEW}</code>}
          <div className={styles.suggestActions}>
            <Button size="sm" onClick={accept}>
              {hasTemp ? 'Accept query' : 'Done'}
            </Button>
            <span className={styles.reviewHint}>
              {hasTemp ? 'Enter to accept · highlight text in the editor to edit' : 'Describe a change below'}
            </span>
          </div>
        </div>
      )}

      {/* NL input: initial prompt, or describe-a-change while previewing/editing */}
      {(phase === 'input' || phase === 'preview' || phase === 'review') && (
        <Input
          ref={inputRef}
          autoFocus
          placeholder={phase === 'input' ? `e.g. "${SCRATCH_NL}"` : 'Describe a change, or press Enter to accept…'}
          value={nl}
          onChange={(e) => setNl(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              if (phase === 'input') {
                if (nl.trim()) {
                  setNl('');
                  setPhase('constructing');
                }
              } else {
                submitNl();
              }
            }
          }}
        />
      )}

      {/* Hint */}
      <div className={styles.hint}>
        {phase === 'input' && 'Describe what you want to measure, then press Enter.'}
        {phase === 'constructing' && 'Mapping your description onto PromQL operators…'}
        {phase === 'building' && 'Assembling the query flow…'}
        {phase === 'preview' &&
          'The 95th-percentile response time per service — what most users actually experience. Accept to keep it.'}
        {phase === 'review' && 'Refine the query in plain language, or highlight part of it in the editor.'}
      </div>
    </div>
  );
}

/** Mid-query: recognise a partial query and suggest the completion. */
function MidQueryPopover({ actions, styles }: { actions: EditorActions; styles: Styles }) {
  const { stage } = useBuildingAnimation(MIDQUERY_STAGES.length, 1100, true);
  const cur = MIDQUERY_STAGES[Math.min(stage, MIDQUERY_STAGES.length - 1)];

  return (
    <div className={styles.popover}>
      <div className={styles.header}>
        <AssistantMark />
        <span className={styles.title}>Assistant</span>
        <span className={styles.dismiss}>esc to dismiss</span>
      </div>

      {cur.chips && (
        <div className={styles.flow}>
          {cur.flowLabel && <div className={styles.flowLabel}>{cur.flowLabel}</div>}
          <QueryChips chips={cur.chips} />
        </div>
      )}

      {cur.suggest && (
        <div className={styles.suggest}>
          <code className={styles.promql}>{MIDQUERY_PROMQL_PREVIEW}</code>
          <div className={styles.suggestActions}>
            <Button size="sm" onClick={() => actions.insert(MIDQUERY_QUERY)}>
              Insert
            </Button>
            <span className={styles.reviewHint}>Tab to review each step</span>
          </div>
        </div>
      )}

      <div className={styles.hint}>{cur.hint}</div>

      {cur.suggest && (
        <div className={styles.tips}>
          {MIDQUERY_TIPS.map((tip, i) => (
            <div key={i} className={styles.tip}>
              <span className={styles.tipDot} />
              {tip}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-2px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    width: 360,
    background: theme.colors.background.elevated ?? theme.colors.background.secondary,
    border: `1px solid ${theme.colors.primary.border}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1.5),
    boxShadow: theme.shadows.z3,
    fontFamily: theme.typography.fontFamily,
    animation: `${fadeIn} 120ms ease-out`,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  title: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.primary.text,
  }),
  dismiss: css({
    fontSize: 10,
    color: theme.colors.text.secondary,
    marginLeft: 'auto',
  }),
  status: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.primary.text,
  }),
  flow: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  flowLabel: css({
    fontSize: 10,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }),
  suggest: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1.25),
  }),
  promql: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10.5,
    lineHeight: 1.6,
    color: theme.colors.text.primary,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.75, 1),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  suggestActions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  reviewHint: css({
    fontSize: 11,
    color: theme.colors.text.secondary,
  }),
  hint: css({
    fontSize: 11.5,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
  }),
  tips: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1),
  }),
  tip: css({
    display: 'flex',
    gap: theme.spacing(1),
    fontSize: 11.5,
    color: theme.colors.text.secondary,
    lineHeight: 1.5,
  }),
  tipDot: css({
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.warning.text,
    flex: 'none',
    marginTop: 5,
  }),
});
