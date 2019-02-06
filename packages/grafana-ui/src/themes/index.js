const darkTheme = require('./dark');
const lightTheme = require('./light');

let mockedTheme;

let getTheme = name => mockedTheme || (name === 'light' ? lightTheme : darkTheme);

const mockTheme = mock => {
  mockedTheme = mock;
  return () => (mockedTheme = null);
};

module.exports = {
  getTheme,
  mockTheme,
};
