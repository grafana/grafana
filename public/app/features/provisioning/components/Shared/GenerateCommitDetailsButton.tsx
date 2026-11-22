import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Spinner, Stack, Tooltip } from '@grafana/ui';
import { StreamStatus, useLLMStream } from 'app/features/dashboard/components/GenAI/hooks';
import {
  AutoGenerateItem,
  EventTrackingSrc,
  reportAutoGenerateInteraction,
} from 'app/features/dashboard/components/GenAI/tracking';
import { DEFAULT_LLM_MODEL, type Message } from 'app/features/dashboard/components/GenAI/utils';

import { type CommitDetails, parseCommitDetails } from '../../utils/commitDetails';

// The whole JSON reply has to arrive before anything is applied, and it carries a PR description.
const GENERATION_TIMEOUT_MS = 30000;

interface Props {
  getMessages: () => Message[];
  onGenerate: (details: CommitDetails) => void;
  disabled?: boolean;
}

/** Asks the LLM app for a commit message, branch name and PR description. Renders nothing when the LLM app is unavailable. */
export function GenerateCommitDetailsButton({ getMessages, onGenerate, disabled }: Props) {
  const [invalidReply, setInvalidReply] = useState(false);

  const onResponse = useCallback(
    (reply: string) => {
      const details = parseCommitDetails(reply);
      setInvalidReply(!details);
      if (details) {
        onGenerate(details);
      }
    },
    [onGenerate]
  );

  const { setMessages, stopGeneration, error, streamStatus, value } = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.3,
    onResponse,
    timeout: GENERATION_TIMEOUT_MS,
  });

  if (!value?.enabled) {
    return null;
  }

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const failed = Boolean(error) || invalidReply;

  const onClick = () => {
    if (isGenerating) {
      stopGeneration();
      reportAutoGenerateInteraction(EventTrackingSrc.provisionedCommitDetails, AutoGenerateItem.stopGenerationButton);
      return;
    }
    setInvalidReply(false);
    setMessages(getMessages());
    reportAutoGenerateInteraction(
      EventTrackingSrc.provisionedCommitDetails,
      failed ? AutoGenerateItem.erroredRetryButton : AutoGenerateItem.autoGenerateButton
    );
  };

  const text = isGenerating
    ? t('provisioning.generate-commit-details.stop', 'Stop generating')
    : failed
      ? t('provisioning.generate-commit-details.retry', 'Retry')
      : t('provisioning.generate-commit-details.generate', 'Generate commit details with AI');

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      {isGenerating && <Spinner size="sm" />}
      <Tooltip
        content={
          failed
            ? t(
                'provisioning.generate-commit-details.error-tooltip',
                'Failed to generate commit details. Please try again or if the problem persists, contact your organization admin.'
              )
            : t(
                'provisioning.generate-commit-details.tooltip',
                'Generates the commit message, branch name and pull request description from the dashboard and its changes'
              )
        }
      >
        <Button
          icon={isGenerating ? undefined : failed ? 'exclamation-circle' : 'ai'}
          onClick={onClick}
          fill="text"
          size="sm"
          variant={failed ? 'destructive' : 'primary'}
          disabled={disabled}
        >
          {text}
        </Button>
      </Tooltip>
    </Stack>
  );
}
