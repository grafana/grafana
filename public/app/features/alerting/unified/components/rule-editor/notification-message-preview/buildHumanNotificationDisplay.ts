import { Annotation } from '../../../utils/constants';

export interface HumanNotificationDisplay {
  title: string;
  body: string;
  secondary?: string;
}

const FIRING_PREFIX_PATTERN = /^\[FIRING:\d+\]\s*/i;

export function stripFiringPrefix(title: string): string {
  return title.replace(FIRING_PREFIX_PATTERN, '').trim();
}

export function buildHumanNotificationDisplay({
  ruleName,
  annotations,
  renderedTitle,
}: {
  ruleName: string;
  annotations: Record<string, string>;
  renderedTitle?: string;
}): HumanNotificationDisplay {
  const summary = annotations[Annotation.summary]?.trim();
  const description = annotations[Annotation.description]?.trim();
  const alertName = ruleName.trim() || 'Untitled alert';

  let title = alertName;
  if (renderedTitle?.trim()) {
    title = stripFiringPrefix(renderedTitle.trim()) || alertName;
  }

  if (summary) {
    return {
      title,
      body: summary,
      secondary: description,
    };
  }

  if (description) {
    return {
      title,
      body: description,
    };
  }

  return {
    title,
    body: alertName,
  };
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function shouldShowRawTemplateOutput(
  renderedBody: string | undefined,
  humanDisplay: HumanNotificationDisplay
): boolean {
  const raw = renderedBody?.trim();
  if (!raw) {
    return false;
  }

  const normalizedRaw = normalizeForCompare(raw);
  const normalizedHumanBody = normalizeForCompare(humanDisplay.body);

  if (normalizedRaw === normalizedHumanBody) {
    return false;
  }

  if (humanDisplay.secondary) {
    const combined = normalizeForCompare(`${humanDisplay.body}\n${humanDisplay.secondary}`);
    if (normalizedRaw === combined) {
      return false;
    }
  }

  return true;
}
