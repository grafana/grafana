import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Stack, Text, TextLink } from '@grafana/ui';

export class NoRelatedLogsScene extends SceneObjectBase<SceneObjectState> {
  static readonly Component = () => {
    return (
      <Stack direction="column" gap={1}>
        <Text color="warning">Related logs is an experimental feature.</Text>
        <Text>
          Related logs are not available for this metric. Try selecting a metric created by a{' '}
          <TextLink external href="https://grafana.com/docs/loki/latest/alert/#recording-rules">
            Loki Recording Rule
          </TextLink>
          , or check back later as we expand the various methods for establishing connections between metrics and logs.
        </Text>
      </Stack>
    );
  };
}
