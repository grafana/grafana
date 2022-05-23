import config from 'app/core/config';

export const getUserThemeMode = () => {
  if (config.bootData.user.lightTheme) {
    return 'light';
  } else if (config.bootData.user.fusebitTheme) {
    return 'fusebit';
  }

  return 'dark';
};
