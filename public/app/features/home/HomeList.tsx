import { css } from '@emotion/css';
import { type ReactNode } from 'react';

// The global reset zeroes list margin and padding but keeps the markers.
const listStyles = css({ listStyle: 'none' });

/** Unstyled list for homepage card rows; each child is an <li>. */
export function HomeList({ children }: { children: ReactNode }) {
  return <ul className={listStyles}>{children}</ul>;
}
