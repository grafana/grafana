const darkTheme = require('./themes/dark');
const lightTheme = require('./themes/light');

const getTheme = name => (name === 'light' ? lightTheme : darkTheme);

const mockTheme = mock => {
  const originalGetTheme = getTheme;
  getTheme = () => mock;
  return () => (getTheme = originalGetTheme);
};

module.exports = {
  getTheme,
  mockTheme,
};
