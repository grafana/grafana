import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type ChatContextItem } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Modal, useStyles2 } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';

import { PromptStep } from './PromptStep';
import { QuestionsStep } from './QuestionsStep';
import { getWizardDatasources, useWizardAssistant } from './api';
import { formatContextItemsForPrompt, scopeDatasourcesToContext } from './context';
import {
  cancelDashboardGenerationPrewarm,
  prewarmDashboardGeneration,
  startDashboardGeneration,
} from './generationState';
import { SHOWCASE_INTENT, WIZARD_ORIGIN, buildGenerationPrompt } from './prompts';
import { supportsLabelLookups } from './tools';
import { type WizardQuestion, type WizardRefinement, type WizardSeed } from './types';

interface Props {
  onDismiss: () => void;
  /** Entry points that already know the subject (datasource page, Explore) pre-seed the wizard. */
  seed?: WizardSeed;
}

type Step = 'prompt' | 'questions';

/** Labels the build agent typically turns into template variables. */
const COMMON_VARIABLE_LABELS = ['job', 'namespace', 'cluster', 'instance'];

/** How many datasources the speculative label prefetch fans out to. */
const MAX_PREFETCH_DATASOURCES = 4;

/**
 * The "Generate dashboard" wizard. The user describes the dashboard in their
 * own words — optionally attaching specific datasources, metrics, labels, or
 * dashboards through the assistant's context picker — and the assistant
 * reorganizes that request into a precise build prompt (verifying the data it
 * refers to), asks one round of clarifying questions only when genuinely
 * needed, and then builds. Alternatively, "Just show me what Grafana can do"
 * skips straight to a showcase build. Building happens headlessly (via
 * DashboardGenerationHost): the assistant's dashboarding agent navigates to
 * the new-dashboard editor and builds into the live scene while a blocking
 * overlay lets the user watch. When it finishes, the overlay lifts and the
 * finished dashboard is left in the editor — new, dirty, and unsaved — for
 * the user to review and save.
 */
export function GenerateDashboardModal({ onDismiss, seed }: Props) {
  const styles = useStyles2(getStyles);
  const { refine, getFindings, prefetchLabelValues } = useWizardAssistant();

  const [step, setStep] = useState<Step>('prompt');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const [freeText, setFreeText] = useState('');
  const [contextItems, setContextItems] = useState<ChatContextItem[]>([]);
  const [refinement, setRefinement] = useState<WizardRefinement | null>(null);

  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const allDatasources = useMemo(() => {
    const list = getWizardDatasources();
    const seedUids = new Set(seed?.datasourceUids ?? []);
    if (seedUids.size === 0) {
      return list;
    }
    const seeded = list.filter((ds) => seedUids.has(ds.uid));
    return seeded.length > 0 ? seeded : list;
  }, [seed]);

  // Datasources the user attached as context narrow the list further.
  const datasources = useMemo(
    () => scopeDatasourcesToContext(allDatasources, contextItems),
    [allDatasources, contextItems]
  );

  const disposed = useRef(false);

  useEffect(() => {
    reportInteraction('dashboard_wizard_opened');
    // Both wizard paths end in a build, so let the host mount the assistant's
    // builder in prewarm mode right away: the chat session the build needs is
    // then already created when generation starts. Also warm the label values
    // the build agent will want for template variables.
    prewarmDashboardGeneration(WIZARD_ORIGIN);
    prefetchLabelValues(
      allDatasources.filter(supportsLabelLookups).slice(0, MAX_PREFETCH_DATASOURCES),
      COMMON_VARIABLE_LABELS
    );
    return () => {
      disposed.current = true;
      // Release the prewarmed assistant session if the user backed out
      // without building (no-op once a generation has started).
      cancelDashboardGenerationPrewarm();
    };
    // Runs exactly once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => (prev.some((existing) => existing.node.id === item.node.id) ? prev : [...prev, item]));
  };

  const handleRemoveContextItem = (item: ChatContextItem) => {
    setContextItems((prev) => prev.filter((existing) => existing.node.id !== item.node.id));
  };

  const handleSubmitPrompt = async () => {
    const written = freeText.trim();
    if (written === '') {
      return;
    }

    setBusy(true);
    setError(undefined);

    const request = seed?.promptHint ? `${written}\n\nWhere this request came from:\n${seed.promptHint}` : written;
    const contextNotes = formatContextItemsForPrompt(contextItems);

    try {
      const result = await refine(request, datasources, contextNotes || undefined);
      if (disposed.current) {
        return;
      }
      setRefinement(result);
      if (result.questions.length > 0) {
        setQuestions(result.questions);
        setAnswers({});
        setStep('questions');
      } else {
        handOffToAssistant(result, []);
      }
    } catch (err) {
      setError(getMessageFromError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleShowMeWhatGrafanaCanDo = () => {
    handOffToAssistant({ prompt: SHOWCASE_INTENT, questions: [] }, []);
  };

  const handleGenerateWithAnswers = () => {
    if (!refinement) {
      return;
    }
    const clarifications = questions
      .map((question) => ({ question: question.text, answer: (answers[question.id] ?? []).join(', ') }))
      .filter((clarification) => clarification.answer !== '');
    handOffToAssistant(refinement, clarifications);
  };

  /**
   * Publishes the composed request for the app-level DashboardGenerationHost,
   * which runs the assistant's dashboarding agent headlessly (no assistant
   * panel). The agent navigates to the new-dashboard editor and builds into
   * the live scene behind the host's blocking overlay; when it finishes the
   * dashboard is left in the editor — new, dirty, and unsaved.
   */
  const handOffToAssistant = (
    result: WizardRefinement,
    clarifications: Array<{ question: string; answer: string }>
  ) => {
    reportInteraction('dashboard_wizard_generated', { contextItems: contextItems.length });

    const contextNotes = formatContextItemsForPrompt(contextItems);

    startDashboardGeneration({
      origin: WIZARD_ORIGIN,
      target: 'new',
      prompt: buildGenerationPrompt({
        intent: result.prompt,
        clarifications,
        datasources,
        dataNotes: result.dataNotes,
        findings: getFindings(),
        contextNotes: contextNotes || undefined,
      }),
    });

    onDismiss();
  };

  return (
    <Modal
      title={t('dashboard-wizard.modal.title', "Let's build a dashboard")}
      isOpen={true}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      {error && (
        <Alert severity="error" title={t('dashboard-wizard.modal.error-title', 'Something went wrong')}>
          {error}
        </Alert>
      )}

      {step === 'prompt' && (
        <PromptStep
          freeText={freeText}
          onFreeTextChange={setFreeText}
          contextItems={contextItems}
          onAddContextItem={handleAddContextItem}
          onRemoveContextItem={handleRemoveContextItem}
          onSubmit={handleSubmitPrompt}
          onShowMeWhatGrafanaCanDo={handleShowMeWhatGrafanaCanDo}
          busy={busy}
        />
      )}

      {step === 'questions' && (
        <QuestionsStep
          questions={questions}
          answers={answers}
          onAnswersChange={setAnswers}
          onGenerate={handleGenerateWithAnswers}
          onBack={() => {
            setStep('prompt');
            setError(undefined);
          }}
        />
      )}
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '100%',
      maxWidth: theme.breakpoints.values.md,
    }),
  };
}
