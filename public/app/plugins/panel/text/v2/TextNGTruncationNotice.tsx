import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { MAX_RENDERED_CHARS } from './renderContent';

export const TRUNCATION_NOTICE_TEST_ID = 'TextNG-truncation-notice';

/**
 * Shown when the character ceiling cut the render short, so an incomplete panel does not
 * read as a finished one. Shared by the panel and the edit-time preview.
 */
export function TextNGTruncationNotice() {
  return (
    <Badge
      color="orange"
      icon="exclamation-triangle"
      text={t('textng.truncation.label', 'Content truncated')}
      tooltip={t(
        'textng.truncation.tooltip',
        'The rendered output passed {{max, number}} characters, so the rest was dropped. Shorten the template, or query fewer rows, to see all of it.',
        { max: MAX_RENDERED_CHARS }
      )}
      data-testid={TRUNCATION_NOTICE_TEST_ID}
    />
  );
}
