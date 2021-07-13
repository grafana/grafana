// We need to centralize the zIndex definitions as they work
// like global values in the browser.
export const zIndex = {
  navbarFixed: 1000,
  sidemenu: 1020,
  dropdown: 1030,
  typeahead: 1030,
  tooltip: 1040,
  modalBackdrop: 1050,
  modal: 1060,
  portal: 1061,
};

/** @beta */
export type ThemeZIndices = typeof zIndex;
