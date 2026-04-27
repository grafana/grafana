import { css } from '@emotion/css';
import { type JSX } from 'react';

import { sanitizeUrl } from '@grafana/data/internal';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BARE_LINK_REGEX = /https?:\/\/[^\s<>()]+/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/;
const SAFE_PROTOCOL_REGEX = /^https?:\/\//i;

interface VariableDescriptionTooltipProps {
  description: string;
  placement: 'top' | 'bottom';
}

export function VariableDescriptionTooltip({ description, placement }: VariableDescriptionTooltipProps) {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip
      content={<div className={styles.tooltipContent}>{renderDescriptionWithLinks(description, styles.link)}</div>}
      placement={placement}
      interactive
    >
      <Icon
        name="info-circle"
        size="sm"
        className={styles.icon}
        aria-label={t('dashboard.variable.description-tooltip', 'Variable description')}
      />
    </Tooltip>
  );
}

function renderDescriptionWithLinks(description: string, linkClassName: string) {
  const elements: Array<string | JSX.Element> = [];
  let nextKey = 0;
  let cursor = 0;

  MARKDOWN_LINK_REGEX.lastIndex = 0;

  for (const match of description.matchAll(MARKDOWN_LINK_REGEX)) {
    const matchStart = match.index ?? 0;

    if (matchStart > cursor) {
      appendTextWithBareLinks(elements, description.slice(cursor, matchStart), linkClassName, () => nextKey++);
    }

    const label = match[1];
    const url = match[2];
    elements.push(renderExternalLinkOrText(label, url, linkClassName, nextKey++));
    cursor = matchStart + match[0].length;
  }

  if (cursor < description.length) {
    appendTextWithBareLinks(elements, description.slice(cursor), linkClassName, () => nextKey++);
  }

  return elements;
}

function appendTextWithBareLinks(
  elements: Array<string | JSX.Element>,
  text: string,
  linkClassName: string,
  getNextKey: () => number
) {
  BARE_LINK_REGEX.lastIndex = 0;
  let cursor = 0;

  for (const match of text.matchAll(BARE_LINK_REGEX)) {
    const matchStart = match.index ?? 0;
    if (matchStart > cursor) {
      elements.push(text.slice(cursor, matchStart));
    }

    const rawMatch = match[0];
    const trimmedUrl = rawMatch.replace(TRAILING_PUNCTUATION_REGEX, '');
    const trailingText = rawMatch.slice(trimmedUrl.length);

    elements.push(renderExternalLinkOrText(trimmedUrl, trimmedUrl, linkClassName, getNextKey()));

    if (trailingText) {
      elements.push(trailingText);
    }

    cursor = matchStart + rawMatch.length;
  }

  if (cursor < text.length) {
    elements.push(text.slice(cursor));
  }
}

function renderExternalLinkOrText(
  label: string,
  url: string,
  linkClassName: string,
  key: number
): string | JSX.Element {
  const safeUrl = getSafeExternalUrl(url);

  if (!safeUrl) {
    return label;
  }

  return (
    <a key={key} href={safeUrl} target="_blank" rel="noopener noreferrer" className={linkClassName}>
      {label}
    </a>
  );
}

function getSafeExternalUrl(url: string): string | undefined {
  const trimmedUrl = url.trim();

  if (!SAFE_PROTOCOL_REGEX.test(trimmedUrl)) {
    return undefined;
  }

  const sanitizedUrl = sanitizeUrl(trimmedUrl);

  if (sanitizedUrl === '' || sanitizedUrl === 'about:blank') {
    return undefined;
  }

  return sanitizedUrl;
}

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    color: theme.colors.text.secondary,
  }),
  tooltipContent: css({
    maxWidth: theme.spacing(40),
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  }),
  link: css({
    color: theme.colors.primary.text,
    textDecoration: 'underline',
  }),
});
