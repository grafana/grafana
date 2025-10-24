import { t } from '@grafana/i18n';
import { Box, Stack, Text } from '@grafana/ui';

interface ErrorMessageRowProps {
  message: string;
}

export function ErrorMessageRow({ message }: ErrorMessageRowProps) {
  return (
    <div data-testid="state-history-error">
      <Box
        display="block"
        backgroundColor="secondary"
        borderStyle="solid"
        borderColor="weak"
        borderRadius="default"
        paddingY={1}
        paddingX={2}
        marginTop={0.5}
      >
        <Stack direction="row" alignItems="center" gap={2} wrap={false}>
          <Box shrink={0}>
            <Text variant="bodySmall" weight="medium" element="span">
              {t('alerting.state-history.error-message-prefix', 'Error message:')}
            </Text>
          </Box>
          <Box grow={1} shrink={1} minWidth={0}>
            <Text variant="bodySmall" truncate element="p">
              {message}
            </Text>
          </Box>
        </Stack>
      </Box>
    </div>
  );
}
