import { css } from '@emotion/css';
import { useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, TextLink, useStyles2 } from '@grafana/ui';

import { CoauthorPopoverV2, type V2Content } from './components/CoauthorPopoverV2';
import { BuildFlow, QueryMapFlow } from './components/HighlightV2Viz';
import { SelectionToolbar } from './components/SelectionToolbar';
import { AI_PURPLE, FLOW1, TOPK_QUERY } from './logic/flows';
import {
  applyOps,
  buildQueryMap,
  previewFromRanges,
  TYPO_QUERY,
  V2_FIX_TYPO,
  V2_LOOKS_LIKE,
  V2_LOOKS_LIKE_TYPO,
  V2_MAX,
  V2_SMOOTH,
} from './logic/highlightV2';
import { analyzeSection } from './logic/tokens';

// Sections snapped from the two demo queries, so every specimen below is fed by
// the same logic the prototype runs on and can't drift from it.
const RATE_AT = TOPK_QUERY.indexOf('rate(');
const SECTION = analyzeSection(TOPK_QUERY, RATE_AT, RATE_AT + 5);
const TYPO_SECTION = analyzeSection(TYPO_QUERY, RATE_AT, RATE_AT + 5);

const PENDING = applyOps(TOPK_QUERY, SECTION?.fn.start ?? 0, [V2_SMOOTH.op]);

const ORIGIN = { left: 0, top: 0 };
const noop = () => {};

/**
 * Component reference for the updated highlight flow — every state of every new
 * piece, labeled, on one page. These are the live components rather than
 * screenshots, so hover states and entrance animations are real.
 * Reachable at /coauthor-components.
 */
export function CoauthorGalleryPage() {
  const styles = useStyles2(getStyles);
  // Bumping this remounts every specimen so entrance animations replay.
  const [take, setTake] = useState(0);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Query coauthor — component reference</h1>
          <p className={styles.subtitle}>
            The new UI pieces in the updated highlight flow, in each of their states. Live components, so hovers,
            transitions and entrance animations behave as they do in the prototype.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" fill="outline" size="sm" icon="sync" onClick={() => setTake((t) => t + 1)}>
            Replay animations
          </Button>
          <TextLink href="/coauthor-highlight">Open the prototype</TextLink>
        </div>
      </header>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.swatchAi} /> AI-generated content
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchPending} /> Pending change, not yet accepted
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchError} /> Unresolvable / error
        </span>
        <span className={styles.legendItem}>
          <kbd className={styles.kbd}>cmd</kbd> + <kbd className={styles.kbd}>/</kbd> opens coauthor from a highlight
        </span>
      </div>

      <div key={take} className={styles.sections}>
        <Section
          title="1 · Selection toolbar"
          file="components/SelectionToolbar.tsx"
          note="Appears above a finished highlight — after mouseup, or after the last modifier is released for a keyboard selection. Never mid-drag. Copy and Query map act immediately; only Coauthor involves AI."
        >
          <Specimen label="Default" note="Centered over the highlight">
            <SelectionToolbar pos={ORIGIN} copied={false} onCopy={noop} onQueryMap={noop} onCoauthor={noop} />
          </Specimen>
          <Specimen label="After Copy" note="Reverts after ~1.6s">
            <SelectionToolbar pos={ORIGIN} copied={true} onCopy={noop} onQueryMap={noop} onCoauthor={noop} />
          </Specimen>
        </Section>

        <Section
          title="2 · Query map (no AI)"
          file="components/CoauthorPopoverV2.tsx · components/HighlightV2Viz.tsx"
          note="Static analysis only — the whole query left to right, with the highlighted section picked out. Hover any node for a short explanation as a third row. The footer is the opt-in into AI."
        >
          <Specimen label="Valid query" note="Hover a node to expand its explanation" wide>
            <Popover content={{ kind: 'map', nodes: buildQueryMap(SECTION) }} />
          </Specimen>
          <Specimen label="Unresolvable metric" note="Category becomes UNKNOWN METRIC; value squiggled" wide>
            <Popover content={{ kind: 'map', nodes: buildQueryMap(TYPO_SECTION) }} />
          </Specimen>
        </Section>

        <Section
          title="3 · Coauthor popover"
          file="components/CoauthorPopoverV2.tsx"
          note="One container, six states. The prompt input keeps focus and text across loading, so typing is never interrupted."
        >
          <Specimen label="Identifying intent (loading)" note="Pulsing, ~900ms">
            <Popover content={{ kind: 'main', loading: true, looksLike: V2_LOOKS_LIKE }} />
          </Specimen>
          <Specimen label="Loaded" note="Quick-change chips, then the Looks like summary">
            <Popover content={{ kind: 'main', loading: false, looksLike: V2_LOOKS_LIKE }} />
          </Specimen>
          <Specimen label="Loaded — query has an error" note="Fix error chip leads the row; summary names the problem">
            <Popover content={{ kind: 'main', loading: false, looksLike: V2_LOOKS_LIKE_TYPO, hasError: true }} />
          </Specimen>
          <Specimen label="Chip drill-in" note="Hovering a suggestion previews it in the query">
            <Popover
              content={{
                kind: 'sub',
                title: 'Swap function',
                placeholder: 'Describe what function you want',
                suggestions: FLOW1.swapFunction,
                tone: 'green',
              }}
            />
          </Specimen>
          <Specimen label="Building" note="Prompt echoed, stop button, nodes filling in">
            <Popover
              content={{ kind: 'building', prompt: 'smooth this out so it’s less jumpy', nodes: V2_SMOOTH.building }}
            />
          </Specimen>
          <Specimen label="Suggestion — first" note="No container or count while there's only one">
            <Popover
              content={{
                kind: 'result',
                why: V2_SMOOTH.why,
                nodes: V2_SMOOTH.result,
                feedback: null,
                index: 0,
                total: 1,
              }}
            />
          </Specimen>
          <Specimen label="Suggestion — 2 of 2" note="Boxed, with a pager; stepping back rolls the query back">
            <Popover
              content={{ kind: 'result', why: V2_MAX.why, nodes: V2_MAX.result, feedback: null, index: 1, total: 2 }}
            />
          </Specimen>
          <Specimen label="Suggestion — error fixed" note="Same shape; here the changed node is the metric">
            <Popover
              content={{
                kind: 'result',
                why: V2_FIX_TYPO.why,
                nodes: V2_FIX_TYPO.result,
                feedback: null,
                index: 0,
                total: 1,
              }}
            />
          </Specimen>
          <Specimen
            label="Modify (from the pencil)"
            note="Whole query with pending edits, position in the run, new prompt"
          >
            <Popover
              content={{
                kind: 'modify',
                segments: previewFromRanges(PENDING.text, PENDING.ranges),
                index: 0,
                total: 1,
              }}
            />
          </Specimen>
          <Specimen label="Out of scope" note="Needs other datasources or extra queries — hands off to Workspace">
            <Popover content={{ kind: 'out-of-scope', feedback: null }} />
          </Specimen>
          <Specimen label="Hand-off" note="Brief, then the popover closes">
            <Popover content={{ kind: 'handoff' }} />
          </Specimen>
        </Section>

        <Section
          title="4 · Flow node language"
          file="components/HighlightV2Viz.tsx"
          note="Two variants of the same nodes. Category badge on top, value below; dashed = inferred or not yet resolved, blue = the part a suggestion touches, red = unresolvable. The map covers the whole query; the build flow covers just the section being changed."
        >
          <Specimen label="Map nodes" note="Whole query; selected nodes solid, hover for hints" wide>
            <Inline>
              <QueryMapFlow nodes={buildQueryMap(SECTION)} />
            </Inline>
          </Specimen>
          <Specimen label="Map nodes — unresolvable" note="Red label, icon and squiggle" wide>
            <Inline>
              <QueryMapFlow nodes={buildQueryMap(TYPO_SECTION)} />
            </Inline>
          </Specimen>
          <Specimen label="Build nodes — in progress" note="Empty node = still being worked out">
            <Inline>
              <BuildFlow nodes={V2_SMOOTH.building} />
            </Inline>
          </Specimen>
          <Specimen label="Build nodes — settled" note="Blue node = what the suggestion changes">
            <Inline>
              <BuildFlow nodes={V2_SMOOTH.result} />
            </Inline>
          </Specimen>
        </Section>
      </div>
    </div>
  );
}

export default CoauthorGalleryPage;

/** Popover specimens take the real component with inert callbacks. */
function Popover({ content }: { content: V2Content }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <CoauthorPopoverV2
      pos={ORIGIN}
      content={content}
      value={value}
      inputRef={inputRef}
      autoFocus={false}
      onInput={setValue}
      onSubmit={noop}
      onBack={noop}
      onStop={noop}
      onAction={noop}
      onSuggestion={noop}
      onSuggestionHover={noop}
      onFeedback={noop}
      onInsert={noop}
      onEdit={noop}
      onAccept={noop}
      onWorkspace={noop}
      onCoauthor={noop}
      onStep={noop}
    />
  );
}

// ---- Layout ---------------------------------------------------------------
interface SectionProps {
  title: string;
  file: string;
  note: string;
  children: React.ReactNode;
}

function Section({ title, file, note, children }: SectionProps) {
  const styles = useStyles2(getStyles);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <code className={styles.sectionFile}>{file}</code>
        <p className={styles.sectionNote}>{note}</p>
      </div>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

interface SpecimenProps {
  label: string;
  note: string;
  /** Full-width row — for specimens too wide or too horizontal for one cell. */
  wide?: boolean;
  children: React.ReactNode;
}

function Specimen({ label, note, wide, children }: SpecimenProps) {
  const styles = useStyles2(getStyles);
  return (
    <figure className={wide ? styles.specimenWide : styles.specimen}>
      <figcaption className={styles.caption}>
        <span className={styles.captionLabel}>{label}</span>
        <span className={styles.captionNote}>{note}</span>
      </figcaption>
      <Stage>{children}</Stage>
    </figure>
  );
}

/**
 * Popovers and the toolbar position themselves absolutely and so have no size of
 * their own — the stage measures its child and follows it, including when a
 * hover expands it.
 */
function Stage({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width?: number; height?: number }>({});

  useLayoutEffect(() => {
    const child = ref.current?.firstElementChild;
    if (!(child instanceof HTMLElement)) {
      return;
    }
    // Only size to the child when it's out of flow. Doing it for a normal-flow
    // child would feed its width back into its own container and collapse it.
    const measure = () =>
      setBox(
        getComputedStyle(child).position === 'absolute' ? { width: child.offsetWidth, height: child.offsetHeight } : {}
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(child);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.stage} style={box}>
      {children}
    </div>
  );
}

/** For specimens that lay out normally and just need padding. */
function Inline({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return <div className={styles.inline}>{children}</div>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    minHeight: '100vh',
    background: theme.colors.background.canvas,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
    padding: theme.spacing(4, 5, 8),
  }),
  header: css({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(4),
    maxWidth: 1400,
    margin: '0 auto',
  }),
  title: css({ margin: 0, fontSize: theme.typography.h2.fontSize }),
  subtitle: css({
    margin: theme.spacing(1, 0, 0),
    maxWidth: 760,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.6,
  }),
  headerActions: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(2), flexShrink: 0 }),

  legend: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    maxWidth: 1400,
    margin: theme.spacing(3, 'auto', 0),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  legendItem: css({ display: 'inline-flex', alignItems: 'center', gap: theme.spacing(1) }),
  swatchAi: css({ width: 10, height: 10, borderRadius: 2, background: AI_PURPLE }),
  swatchPending: css({ width: 10, height: 10, borderRadius: 2, background: 'rgba(110, 159, 255, 0.6)' }),
  swatchError: css({ width: 10, height: 10, borderRadius: 2, background: theme.colors.error.text }),
  kbd: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 11,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: 3,
    padding: '1px 5px',
  }),

  sections: css({ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: theme.spacing(5) }),
  section: css({ marginTop: theme.spacing(3) }),
  sectionHead: css({ marginBottom: theme.spacing(3) }),
  sectionTitle: css({ margin: 0, fontSize: theme.typography.h4.fontSize }),
  sectionFile: css({
    display: 'inline-block',
    marginTop: theme.spacing(0.5),
    color: theme.colors.text.disabled,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  sectionNote: css({
    margin: theme.spacing(1, 0, 0),
    maxWidth: 900,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.6,
  }),

  grid: css({
    display: 'grid',
    // Wide enough that no popover state gets clamped by its cell.
    gridTemplateColumns: 'repeat(auto-fill, minmax(540px, 1fr))',
    gap: theme.spacing(3),
    alignItems: 'start',
  }),
  specimen: css({ margin: 0 }),
  specimenWide: css({ margin: 0, gridColumn: '1 / -1' }),
  caption: css({ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: theme.spacing(1) }),
  captionLabel: css({ color: theme.colors.text.primary, fontWeight: theme.typography.fontWeightMedium }),
  captionNote: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  stage: css({
    position: 'relative',
    // Width/height come from the measured specimen, so the frame hugs it
    // instead of leaving dead space around absolutely-positioned components.
    maxWidth: '100%',
    borderRadius: theme.shape.radius.default,
    border: `1px dashed ${theme.colors.border.weak}`,
    background: theme.colors.background.canvas,
    transition: 'height 0.15s ease',
  }),
  // Block, not shrink-to-fit: the flow visualisations need the available width
  // to lay out left to right instead of collapsing into a column.
  inline: css({ padding: theme.spacing(2) }),
});
