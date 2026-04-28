import { css } from '@emotion/css';

import { type GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Text, useStyles2 } from '@grafana/ui';

interface Props {
  /** The `resource.file` blob returned by the provisioning files API. */
  file: unknown;
}

/**
 * Renders a README markdown payload produced by the provisioning files API.
 * Used by the dedicated README tab.
 */
export function RenderedReadme({ file }: Props) {
  const styles = useStyles2(getStyles);
  const markdown = extractMarkdownContent(file);

  if (!markdown) {
    return (
      <Box paddingY={2}>
        <Text color="secondary">
          <Trans i18nKey="browse-dashboards.readme.parse-error">Unable to display README content.</Trans>
        </Text>
      </Box>
    );
  }

  const renderedHtml = renderMarkdown(markdown);

  return (
    <div className={styles.container}>
      <div className="markdown-html" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
}

function extractMarkdownContent(file: unknown): string | undefined {
  if (!file) {
    return undefined;
  }

  if (typeof file === 'string') {
    return file;
  }

  if (!isStringRecord(file)) {
    return undefined;
  }

  for (const key of ['content', 'data', 'spec', 'raw']) {
    const value = file[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return undefined;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
  }),
});
