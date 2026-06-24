import { Trans } from '@grafana/i18n';
import { Stack, TextLink } from '@grafana/ui';

interface Props {
  feedbackUrl: string;
}

export function LogsFeedback({ feedbackUrl }: Props) {
  return (
    <Stack>
      <TextLink href={feedbackUrl} external>
        <Trans i18nKey="explore.logs-feedback.give-feedback">Give feedback</Trans>
      </TextLink>
    </Stack>
  );
}
