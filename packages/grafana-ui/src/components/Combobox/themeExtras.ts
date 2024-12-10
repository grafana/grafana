const defaultValues = {
  controlMenuOffset: -1,
  controlMenuBorderRadius: 2,
  controlOptionBorderRadius: 0,
  controlBorderWidth: 1,

  menuOptionGap: 0,

  dropShadow: '0px 8px 24px rgb(1, 4, 9)',
};

const differentValues: typeof defaultValues = {
  controlMenuOffset: 8,
  controlMenuBorderRadius: 5,
  controlOptionBorderRadius: 2,
  controlBorderWidth: 2,

  // Distance between the visually highlighted option and the menu borders
  menuOptionGap: 4,

  dropShadow: [
    '0px 2px 2px -1px #00000026',
    '0px 4px 4px -2px #00000026',
    '0px 8px 8px -4px #00000026',
    '0px 16px 16px -8px #00000026',
    '0px 32px 32px -16px #00000026',
  ].join(', '),
};

const searchParams = new URLSearchParams(window.location.search);
const useDifferentTheme = !searchParams.has('_normalTheme');

export const tempThemeExtras = useDifferentTheme ? differentValues : defaultValues;
