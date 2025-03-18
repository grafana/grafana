import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { Stack, Text, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export class NoRelatedLogsScene extends SceneObjectBase<SceneObjectState> {
  static readonly Component = () => {
    return (
      <Stack direction="column" gap={1}>
        <Text color="warning">
          <Trans i18nKey="explore-metrics.related-logs.warnExperimentalFeature">
            Related logs is an experimental feature.
          </Trans>
        </Text>
        <Text>
          <Trans i18nKey="explore-metrics.related-logs.relatedLogsUnavailableBeforeDocsLink">
            Related logs are not available for this metric. Try selecting a metric created by a{' '}
          </Trans>
          <TextLink external href="https://grafana.com/docs/loki/latest/alert/#recording-rules">
            <Trans i18nKey="explore-metrics.related-logs.docsLink">Loki Recording Rule</Trans>
          </TextLink>
          <Trans i18nKey="explore-metrics.related-logs.relatedLogsUnavailableAfterDocsLink">
            , or check back later as we expand the various methods for establishing connections between metrics and
            logs.
          </Trans>
        </Text>
      </Stack>
    );
  };
}
