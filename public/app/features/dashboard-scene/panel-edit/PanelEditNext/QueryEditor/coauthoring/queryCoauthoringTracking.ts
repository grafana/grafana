import { reportInteraction } from '@grafana/runtime';

import { type QueryPreviewOutcome } from './queryCoauthoringPreviewOutcome';

export type QueryCoauthoringHandoffSource = 'clarification' | 'iteration_nudge' | 'fallback' | 'proposal';

interface QueryCoauthoringEventContext {
  datasourceType: string;
}

export function trackQueryCoauthoringOpened({ datasourceType }: QueryCoauthoringEventContext) {
  reportInteraction('grafana_query_coauthoring_opened_popover', {
    datasource_type: datasourceType,
  });
}

export function trackQueryCoauthoringPromptSubmitted({
  datasourceType,
  promptStage,
}: QueryCoauthoringEventContext & { promptStage: 'initial' | 'clarification' }) {
  reportInteraction('grafana_query_coauthoring_submitted_prompt', {
    datasource_type: datasourceType,
    prompt_stage: promptStage,
  });
}

export function trackQueryCoauthoringGenerationStopped({ datasourceType }: QueryCoauthoringEventContext) {
  reportInteraction('grafana_query_coauthoring_stopped_generation', {
    datasource_type: datasourceType,
  });
}

export function trackQueryCoauthoringProposalAccepted({ datasourceType }: QueryCoauthoringEventContext) {
  reportInteraction('grafana_query_coauthoring_accepted_proposal', {
    datasource_type: datasourceType,
  });
}

export function trackQueryCoauthoringContinuedInAssistant({
  datasourceType,
  sourceState,
}: QueryCoauthoringEventContext & { sourceState: QueryCoauthoringHandoffSource }) {
  reportInteraction('grafana_query_coauthoring_continued_assistant_chat', {
    datasource_type: datasourceType,
    source_state: sourceState,
  });
}

export function trackQueryCoauthoringDismissed({ datasourceType }: QueryCoauthoringEventContext) {
  reportInteraction('grafana_query_coauthoring_dismissed_popover', {
    datasource_type: datasourceType,
  });
}

export function trackQueryCoauthoringExplainFollowUpSubmitted(source: 'generated' | 'typed') {
  reportInteraction('grafana_query_coauthoring_explain_follow_up_submitted', { source });
}

export function trackQueryCoauthoringExploreSimilarUsed() {
  reportInteraction('grafana_query_coauthoring_explore_similar_used', {});
}

export function trackQueryCoauthoringMentionInserted(kind: 'metric' | 'label') {
  reportInteraction('grafana_query_coauthoring_mention_inserted', { kind });
}

export function trackQueryCoauthoringOptionSelected(rank: number) {
  reportInteraction('grafana_query_coauthoring_option_selected', { rank });
}

export function trackQueryCoauthoringPreviewOutcomeShown(kind: QueryPreviewOutcome['kind']) {
  reportInteraction('grafana_query_coauthoring_preview_outcome_shown', { kind });
}

export function trackQueryCoauthoringOptionPeeked(rank: number) {
  reportInteraction('grafana_query_coauthoring_option_peeked', { rank });
}
