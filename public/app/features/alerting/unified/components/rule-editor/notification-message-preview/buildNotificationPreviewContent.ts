import { Annotation } from '../../../utils/constants';

export interface NotificationPreviewContent {
  title: string;
  primaryLine: string;
  secondaryLine?: string;
}

export function annotationsArrayToRecord(annotations: Array<{ key: string; value: string }>): Record<string, string> {
  return Object.fromEntries(
    annotations.filter(({ key, value }) => Boolean(key?.trim()) && Boolean(value?.trim())).map(({ key, value }) => [key, value])
  );
}

export function buildNotificationPreviewContent({
  ruleName,
  annotations,
}: {
  ruleName: string;
  annotations: Record<string, string>;
}): NotificationPreviewContent {
  const alertTitle = ruleName.trim() || 'Untitled alert';
  const title = `[FIRING:1] ${alertTitle}`;

  const summary = annotations[Annotation.summary]?.trim();
  const description = annotations[Annotation.description]?.trim();

  if (summary) {
    return {
      title,
      primaryLine: summary,
      secondaryLine: description,
    };
  }

  if (description) {
    return {
      title,
      primaryLine: description,
    };
  }

  return {
    title,
    primaryLine: alertTitle,
  };
}
