import { useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';

interface TransformationSearchStatusProps {
  count: number;
}

/**
 * Visually hidden live region announcing the number of transformation search results,
 * so screen readers give feedback as the user searches (WCAG 4.1.3 Status Messages).
 */
export function TransformationSearchStatus({ count }: TransformationSearchStatusProps) {
  const [announcement, setAnnouncement] = useState('');

  // Debounced so screen readers don't announce a new count on every keystroke
  useDebounce(
    () => {
      setAnnouncement(
        count === 0
          ? t('dashboard.transformation-search-status.no-results', 'No transformations found')
          : t('dashboard.transformation-search-status.results-found', '', {
              count,
              defaultValue_one: '{{count}} transformation found',
              defaultValue_other: '{{count}} transformations found',
            })
      );
    },
    500,
    [count]
  );

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}
