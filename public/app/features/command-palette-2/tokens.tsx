export const tokens = {
  colors: {
    grey: {
      50: '#F6F6FA',
      100: '#EAEAF1',
      200: '#DFDFE6',
      300: '#C4C4CB',
      400: '#9B9BA3',
      500: '#75757D',
      600: '#45454D',
      700: '#2D2D32',
      800: '#202027',
      900: '#121216',
      950: '#0D0D0F',
    },
  },
};

export const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
