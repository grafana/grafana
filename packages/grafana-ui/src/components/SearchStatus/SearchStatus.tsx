import { useState } from 'react';
import { useDebounce } from 'react-use';

export interface SearchStatusProps {
  /**
   * Already translated and formatted, e.g. "3 data sources found". Owned by the
   * caller so this component holds no translatable strings of its own.
   */
  message: string;
}

/**
 * Visually hidden live region announcing search results, so screen readers give
 * feedback as the user types (WCAG 4.1.3 Status Messages).
 *
 * Renders empty on mount and fills in after the debounce, so the announcement lands
 * as a text change inside an existing live region rather than as mount-time content,
 * which screen readers skip.
 */
export function SearchStatus({ message }: SearchStatusProps) {
  const [announcement, setAnnouncement] = useState('');

  // Debounced so screen readers don't announce a new result count on every keystroke
  useDebounce(() => setAnnouncement(message), 500, [message]);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}
