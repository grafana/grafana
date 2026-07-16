import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Button,
  CollapsableSection,
  Icon,
  Input,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
  useStyles2,
} from '@grafana/ui';

import { type WizardSummary, type WizardSummarySection } from './types';

interface Props {
  /** The assistant's plain-language plan; falls back to `fallbackText` when absent. */
  summary?: WizardSummary;
  /** The refined build prompt, shown when the model returned no structured summary. */
  fallbackText: string;
  /** Names of the datasources the dashboard will be built from. */
  datasourceNames: string[];
  /** The clarifying questions the user answered, if any. */
  clarifications: Array<{ question: string; answer: string }>;
  /** True while a refine round-trip is in flight. */
  busy?: boolean;
  /** Ask the assistant to change the plan based on the user's feedback. */
  onRefine: (feedback: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}

/**
 * Review screen shown before the build: a panel-by-panel preview of the
 * dashboard the assistant is about to generate. The user can confirm, refine
 * the plan with feedback, or go back and adjust their answers.
 */
export function SummaryStep(props: Props) {
  const { summary, fallbackText, datasourceNames, clarifications, busy, onRefine, onGenerate, onBack } = props;

  const styles = useStyles2(getStyles);
  const [feedback, setFeedback] = useState('');
  const hasSections = summary && summary.sections.length > 0;

  // Clear the feedback field once an updated plan comes back.
  useEffect(() => {
    setFeedback('');
  }, [summary]);

  const hasFeedback = feedback.trim() !== '';

  const submitFeedback = () => {
    if (!busy && hasFeedback) {
      onRefine(feedback);
    }
  };

  // A single primary action: with feedback typed it refines the plan, otherwise
  // it kicks off the build.
  const handlePrimary = () => {
    if (busy) {
      return;
    }
    if (hasFeedback) {
      submitFeedback();
    } else {
      onGenerate();
    }
  };

  return (
    <div className={styles.container}>
      <Text element="h3" variant="h5">
        {t('dashboard-wizard.summary-step.title', "Here's what we'll build")}
      </Text>

      <div className={styles.card}>
        <div className={styles.header}>
          <Icon name="apps" size="lg" className={styles.accent} />
          <Text element="h4" variant="h5">
            {summary?.title ?? t('dashboard-wizard.summary-step.default-title', 'New dashboard')}
          </Text>
        </div>

        <Text color="secondary">{summary?.description ? summary.description : fallbackText}</Text>

        {hasSections && (
          <div className={styles.layout}>
            <Icon name="layer-group" size="sm" className={styles.accent} />
            <Text variant="bodySmall" color="secondary">
              {summary.structure === 'tabs'
                ? t('dashboard-wizard.summary-step.structure-tabs', '', {
                    count: summary.sections.length,
                    defaultValue_one: 'Organized into {{count}} tab',
                    defaultValue_other: 'Organized into {{count}} tabs',
                  })
                : t('dashboard-wizard.summary-step.structure-rows', '', {
                    count: summary.sections.length,
                    defaultValue_one: 'Organized into {{count}} stacked row',
                    defaultValue_other: 'Organized into {{count}} stacked rows',
                  })}
            </Text>
          </div>
        )}

        {hasSections && <SectionList sections={summary.sections} />}
      </div>

      {datasourceNames.length > 0 && (
        <div className={styles.meta}>
          <Text variant="bodySmall" weight="medium" color="secondary">
            {t('dashboard-wizard.summary-step.data-sources', 'Data sources')}
          </Text>
          <div className={styles.chips}>
            {datasourceNames.map((name) => (
              <span key={name} className={styles.chip}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {clarifications.length > 0 && (
        <div className={styles.meta}>
          <Text variant="bodySmall" weight="medium" color="secondary">
            {t('dashboard-wizard.summary-step.your-choices', 'Your choices')}
          </Text>
          <Stack direction="column" gap={0.5}>
            {clarifications.map((clarification) => (
              <Text key={clarification.question} variant="bodySmall" color="secondary">
                {clarification.question} — {clarification.answer}
              </Text>
            ))}
          </Stack>
        </div>
      )}

      <div className={styles.meta}>
        <Text variant="bodySmall" weight="medium" color="secondary">
          {t('dashboard-wizard.summary-step.refine-label', 'Not quite right? Tell the assistant what to change')}
        </Text>
        <Input
          value={feedback}
          onChange={(event) => setFeedback(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitFeedback();
            }
          }}
          placeholder={t(
            'dashboard-wizard.summary-step.refine-placeholder',
            'e.g. add a section for cache hit ratio, or use a table for errors'
          )}
          disabled={busy}
        />
      </div>

      <Stack justifyContent="space-between">
        <Button variant="secondary" fill="outline" onClick={onBack}>
          {t('dashboard-wizard.summary-step.back', 'Back')}
        </Button>
        <Button onClick={handlePrimary} icon={hasFeedback ? (busy ? 'spinner' : 'sync') : 'ai-sparkle'} disabled={busy}>
          {hasFeedback
            ? t('dashboard-wizard.summary-step.refine', 'Refine plan')
            : t('dashboard-wizard.summary-step.generate', 'Generate dashboard')}
        </Button>
      </Stack>
    </div>
  );
}

/**
 * A group of sibling sections. When they are all tabs, they render as real
 * clickable tabs showing one tab's content at a time; rows render as stacked
 * blocks, echoing how they appear in the dashboard editor.
 *
 * `depth` drives the type scale: first-level titles and tab labels render at
 * body size, everything nested steps down to bodySmall so a parent is never
 * visually outweighed by its children.
 */
function SectionList({ sections, depth = 0 }: { sections: WizardSummarySection[]; depth?: number }) {
  const styles = useStyles2(getStyles);
  // Clamped so a plan refinement that removes tabs never strands the selection.
  const [activeIndex, setActiveIndex] = useState(0);
  const allTabs = sections.length > 0 && sections.every((section) => section.kind === 'tab');

  if (allTabs) {
    const active = Math.min(activeIndex, sections.length - 1);
    return (
      <div className={depth > 0 ? cx(styles.sections, styles.nestedTabs) : styles.sections}>
        <TabsBar>
          {sections.map((section, index) => (
            <Tab
              key={index}
              label={section.title}
              active={index === active}
              onChangeTab={() => setActiveIndex(index)}
            />
          ))}
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {/* Keyed by tab so nested selection/collapse state never leaks between tabs. */}
          <SectionContent key={active} section={sections[active]} depth={depth} />
        </TabContent>
      </div>
    );
  }

  return (
    <div className={depth > 0 ? cx(styles.sections, styles.nestedSections) : styles.sections}>
      {sections.map((section, index) => (
        <SectionBlock key={index} section={section} depth={depth} />
      ))}
    </div>
  );
}

/** The inside of a section: its planned panels, or the sections nested in it. */
function SectionContent({ section, depth }: { section: WizardSummarySection; depth: number }) {
  const styles = useStyles2(getStyles);

  return (
    <>
      {section.panels.length > 0 && (
        <ul className={styles.panels}>
          {section.panels.map((panel, panelIndex) => (
            <li key={panelIndex} className={styles.panel}>
              {/* Always render the chip cell so the title always lands in the second grid column. */}
              <span className={panel.visualization ? styles.vizChip : undefined}>{panel.visualization}</span>
              <span className={styles.panelTitle}>{panel.title}</span>
            </li>
          ))}
        </ul>
      )}
      {section.sections && section.sections.length > 0 && <SectionList sections={section.sections} depth={depth + 1} />}
    </>
  );
}

/** One planned row (or a tab mixed among rows): its header and its content, stacked. */
function SectionBlock({ section, depth }: { section: WizardSummarySection; depth: number }) {
  const styles = useStyles2(getStyles);
  const isTab = section.kind === 'tab';

  const title = (
    <Text variant={depth === 0 ? 'body' : 'bodySmall'} weight="medium">
      {section.title}
    </Text>
  );

  if (!isTab) {
    // Rows collapse like real dashboard rows; expanded by default so the whole
    // plan is visible when the summary opens.
    return (
      <div className={styles.rowBlock}>
        <CollapsableSection
          isOpen={true}
          label={title}
          className={styles.rowHeader}
          contentClassName={styles.rowContent}
        >
          <SectionContent section={section} depth={depth} />
        </CollapsableSection>
      </div>
    );
  }

  return (
    <div className={styles.tabBlock}>
      <div className={styles.sectionHeader}>
        {title}
        <span className={styles.kindBadge}>{t('dashboard-wizard.summary-step.kind-tab', 'Tab')}</span>
      </div>
      <SectionContent section={section} depth={depth} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    card: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    accent: css({
      color: theme.colors.primary.text,
      flexShrink: 0,
    }),
    layout: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sections: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(0.5),
    }),
    tabContent: css({
      // The summary card provides its own background; keep the tab content transparent.
      background: 'transparent',
      paddingTop: theme.spacing(1),
    }),
    // Nested section groups pull in from the right so their separators stop
    // short of the parent's, making the hierarchy visible at a glance.
    nestedSections: css({
      marginRight: theme.spacing(4),
    }),
    // Tab labels of a nested tab group step down to bodySmall (with tighter
    // padding) so they never outweigh the title of the section holding them.
    nestedTabs: css({
      '[role="tab"]': {
        fontSize: theme.typography.bodySmall.fontSize,
        padding: theme.spacing(0.5, 1, 0.5),
      },
    }),
    tabBlock: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
      paddingLeft: theme.spacing(1.5),
      borderLeft: `2px solid ${theme.colors.border.medium}`,
    }),
    rowBlock: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    sectionHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
    }),
    // Applied to CollapsableSection's header: keep the separator under the
    // row title and tighten the component's default (large) header padding.
    rowHeader: css({
      padding: theme.spacing(0, 0, 0.5),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    rowContent: css({
      padding: theme.spacing(1, 0, 0),
    }),
    kindBadge: css({
      padding: theme.spacing(0, 0.75),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.pxToRem(11),
      whiteSpace: 'nowrap',
    }),
    // Two-column grid (chip | title) so every panel title shares the same left
    // edge regardless of how wide its visualization chip is.
    panels: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      alignItems: 'center',
      columnGap: theme.spacing(1),
      rowGap: theme.spacing(0.5),
    }),
    // Each list item contributes its two children directly to the grid.
    panel: css({
      display: 'contents',
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
    }),
    vizChip: css({
      // Hug the content instead of stretching to the grid column's width
      // (which is sized by the widest chip in the section).
      justifySelf: 'start',
      padding: theme.spacing(0, 0.75),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.pxToRem(11),
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }),
    panelTitle: css({
      minWidth: 0,
    }),
    meta: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    chips: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
    chip: css({
      padding: theme.spacing(0.25, 1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
