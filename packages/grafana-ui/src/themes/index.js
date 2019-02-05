const darkTheme = require('./dark');
const lightTheme = require('./light');

const getTheme = name => (name === 'light' ? lightTheme : darkTheme);

const mockTheme = mock => {
  const originalGetTheme = getTheme;
  getTheme = () => mock;
  return () => (getTheme = originalGetTheme);
};

module.exports = {
  getTheme,
  mockTheme
};
