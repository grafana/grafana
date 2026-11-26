/**
 * A window with a sidebar, for the button that shows, docks and closes the mega menu. The icon set has no such glyph;
 * it is drawn at the size of an `xl` icon, in the button's text colour.
 */
export function MegaMenuToggleIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <rect x="2.875" y="4.875" width="18.25" height="14.25" rx="3" />
      <path d="M7.5 9v6" />
    </svg>
  );
}
