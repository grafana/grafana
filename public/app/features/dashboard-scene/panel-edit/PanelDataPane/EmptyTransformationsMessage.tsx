import { selectors } from '@grafana/e2e-selectors';
import { Box, Button, Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

interface EmptyTransformationsProps {
  onShowPicker: () => void;
}
export function EmptyTransformationsMessage(props: EmptyTransformationsProps) {
  return (
    <Box alignItems="center" padding={4}>
      <Stack direction="column" alignItems="center" gap={2}>
        <Text element="h3" textAlignment="center">
          <Trans i18nKey="transformations.empty.add-transformation-header">Start transforming data</Trans>
        </Text>
        <Text element="p" textAlignment="center" data-testid={selectors.components.Transforms.noTransformationsMessage}>
          <Trans i18nKey="transformations.empty.add-transformation-body">
            Transformations allow data to be changed in various ways before your visualization is shown.
            <br />
            This includes joining data together, renaming fields, making calculations, formatting data for display, and
            more.
          </Trans>
        </Text>
        <Button
          icon="plus"
          variant="primary"
          size="md"
          onClick={props.onShowPicker}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          <Trans i18nKey="dashboard-scene.empty-transformations-message.add-transformation">Add transformation</Trans>
        </Button>
      </Stack>
    </Box>
  );
}
