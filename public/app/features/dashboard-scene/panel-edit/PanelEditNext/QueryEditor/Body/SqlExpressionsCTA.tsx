import { Trans } from '@grafana/i18n';
import { Box, Button, Stack, Text } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';

export function SqlExpressionsCTA({ onAddSqlExpression }: { onAddSqlExpression: () => void }) {
  return (
    <Box backgroundColor="info" borderRadius="default" paddingX={1} paddingY={1.5}>
      <Stack direction="row" alignItems="center" gap={1} justifyContent="space-between">
        <Stack alignItems="center" gap={1}>
          <Icon name="database" />
          <Text variant="bodySmall" color="maxContrast">
            <Trans i18nKey="dashboard.transformation-type-picker.sql-cta-description">
              Prefer SQL? Add a SQL expression to your queries instead.
            </Trans>
          </Text>
        </Stack>
        <Button
          variant="primary"
          size="sm"
          fill="outline"
          onClick={onAddSqlExpression}
          data-testid="sql-expressions-cta-button"
        >
          <Trans i18nKey="dashboard.transformation-type-picker.sql-cta-button">Add SQL expression</Trans>
        </Button>
      </Stack>
    </Box>
  );
}
