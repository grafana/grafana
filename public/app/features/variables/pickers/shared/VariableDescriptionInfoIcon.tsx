import { css, cx } from '@emotion/css';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  description: string;
  docsUrl?: string | null;
  label?: string;
}

export function getSafeDocsUrl(docsUrl?: string | null): string | undefined {
  if (!docsUrl) {
    return undefined;
  }

  const sanitized = textUtil.sanitizeUrl(docsUrl);

  if (!sanitized || sanitized === 'about:blank') {
    return undefined;
  }

  return sanitized;
}

export function VariableDescriptionInfoIcon({ description, docsUrl, label }: Props) {
  const styles = useStyles2(getStyles);
  const safeDocsUrl = getSafeDocsUrl(docsUrl);
  const ariaLabel = label ? `Open documentation for variable ${label}` : 'Open variable documentation';

  const icon = <Icon name="info-circle" size="sm" />;

  const iconElement = safeDocsUrl ? (
    <a
      aria-label={ariaLabel}
      className={cx(styles.iconContainer, styles.iconLink)}
      data-testid="variable-description-docs-link"
      href={safeDocsUrl}
      onClick={(event) => event.stopPropagation()}
      rel="noopener noreferrer"
      target="_blank"
    >
      {icon}
    </a>
  ) : (
    <span className={styles.iconContainer} data-testid="variable-description-info-icon">
      {icon}
    </span>
  );

  return (
    <Tooltip content={description} placement="bottom">
      {iconElement}
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  iconContainer: css({
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 0,
    verticalAlign: 'middle',
    marginBottom: theme.spacing(0.5),
  }),
  iconLink: css({
    textDecoration: 'none',
  }),
});
