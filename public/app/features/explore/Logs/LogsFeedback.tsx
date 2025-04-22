import { Stack, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

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
