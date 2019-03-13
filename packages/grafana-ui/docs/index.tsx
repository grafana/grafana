import React from 'react';
import ReactDOM from 'react-dom';
import App from './src/App';
// @ts-ignore
import metadata from './metadata.json';
// @ts-ignore
import darkTheme from './public/sass/dark.scss';
// @ts-ignore
import lightTheme from './public/sass/light.scss';

lightTheme.use();

const handleThemeChange = (theme: string) => {
  if (theme !== 'light') {
    lightTheme.unuse();
    darkTheme.use();
  } else {
    darkTheme.unuse();
    lightTheme.use();
  }
};

ReactDOM.render(<App docsMetadata={metadata} onThemeChange={handleThemeChange} />, document.getElementById('root'));
