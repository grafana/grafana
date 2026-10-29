import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { MAX_RENDERED_CHARS, MAX_RENDERED_ROWS } from './renderContent';

export const TRUNCATION_NOTICE_TEST_ID = 'TextNG-truncation-notice';

/**
 * Shown when either render ceiling cut the pass short, so an incomplete panel does not read as
 * a finished one. Shared by the panel and the edit-time preview.
 */
export function TextNGTruncationNotice() {
  return (
    <Badge
      color="orange"
      icon="exclamation-triangle"
      text={t('textng.truncation.label', 'Content truncated')}
      tooltip={t(
        'textng.truncation.tooltip',
        'The render hit a ceiling of {{maxChars, number}} characters or {{maxRows, number}} rows, so the rest was dropped. Shorten the template, or query fewer rows, to see all of it.',
        { maxChars: MAX_RENDERED_CHARS, maxRows: MAX_RENDERED_ROWS }
      )}
      data-testid={TRUNCATION_NOTICE_TEST_ID}
    />
  );
}
