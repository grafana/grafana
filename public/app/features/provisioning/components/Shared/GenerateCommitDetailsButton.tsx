import { useState } from 'react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Button, Spinner, Stack, Tooltip } from '@grafana/ui';

import { type CommitDetails, type CommitDetailsPrompt, parseCommitDetails } from '../../utils/commitDetails';

interface Props {
  getPrompt: () => CommitDetailsPrompt;
  onGenerate: (details: CommitDetails) => void;
  disabled?: boolean;
}

/** Asks Grafana Assistant for a commit message, branch name and PR description. Renders nothing when the Assistant is unavailable. */
export function GenerateCommitDetailsButton({ getPrompt, onGenerate, disabled }: Props) {
  const { isAvailable } = useAssistant();
  const { generate, cancel, isGenerating, error } = useInlineAssistant();
  const [invalidReply, setInvalidReply] = useState(false);

  if (!isAvailable) {
    return null;
  }

  const failed = Boolean(error) || invalidReply;

  const onClick = () => {
    if (isGenerating) {
      cancel();
      return;
    }
    setInvalidReply(false);
    generate({
      ...getPrompt(),
      origin: 'grafana/provisioning/save-dashboard/commit-details',
      agentName: 'commit-details-generator',
      onComplete: (reply) => {
        const details = parseCommitDetails(reply);
        setInvalidReply(!details);
        if (details) {
          onGenerate(details);
        }
      },
    });
  };

  const text = isGenerating
    ? t('provisioning.generate-commit-details.stop', 'Stop generating')
    : failed
      ? t('provisioning.generate-commit-details.retry', 'Retry')
      : t('provisioning.generate-commit-details.generate', 'Generate commit details with Assistant');

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
          icon={isGenerating ? undefined : failed ? 'exclamation-circle' : 'ai-sparkle'}
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
