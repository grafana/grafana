import { css } from '@emotion/css';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { createRelativeUrl, isRelativeUrl } from '../utils/url';

interface EnrichmentItem {
  type: string;
  name?: string;
  exploreLink?: string;
  expr?: string;
  lines?: string[];
}

interface AlertEnrichmentsProps {
  enrichments: Record<string, unknown>;
}

export function AlertEnrichments({ enrichments }: AlertEnrichmentsProps) {
  const items = enrichments?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        <strong>
          <Trans i18nKey="alerting.notification-history.enrichments">Enrichments:</Trans>
        </strong>
      </Text>
      {items.map((item: EnrichmentItem, idx: number) => (
        <EnrichmentItemView key={idx} item={item} />
      ))}
    </Stack>
  );
}

function EnrichmentItemView({ item }: { item: EnrichmentItem }) {
  const styles = useStyles2(getStyles);

  // LinkButton renders an <a> tag so we need createRelativeUrl for subpath support
  const sanitizedLink = item.exploreLink ? textUtil.sanitizeUrl(item.exploreLink) : undefined;
  const exploreHref = sanitizedLink && isRelativeUrl(sanitizedLink) ? createRelativeUrl(sanitizedLink) : sanitizedLink;

  if (item.type === 'logs') {
    return (
      <div className={styles.enrichmentItem}>
        <Stack direction="column" gap={0.5}>
          <Stack direction="row" gap={1} alignItems="center">
            <Badge color="blue" text={t('alerting.notification-history.enrichment-type-logs', 'logs')} />
            {exploreHref && (
              <LinkButton size="sm" variant="secondary" icon="compass" href={exploreHref} target="_blank">
                <Trans i18nKey="alerting.notification-history.enrichment-explore">View in Explore</Trans>
              </LinkButton>
            )}
          </Stack>
          {item.lines && item.lines.length > 0 && (
            <pre className={styles.logLines}>
              {item.lines.map((line, i) => (
                <div key={i}>{line.trimEnd()}</div>
              ))}
            </pre>
          )}
          {(!item.lines || item.lines.length === 0) && (
            <Text variant="bodySmall" color="secondary" italic>
              <Trans i18nKey="alerting.notification-history.enrichment-no-logs">No log lines</Trans>
            </Text>
          )}
        </Stack>
      </div>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  enrichmentItem: css({
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  logLines: css({
    margin: 0,
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});
