import React from 'react';
import ReactDOM from 'react-dom';

// @ts-ignore
import metadata from './metadata.json';
import App from './src/App';

import dark from './src/dark.scss';
import light from './src/light.scss';

console.log(dark, light);

ReactDOM.render(<App docsMetadata={metadata} />, document.getElementById('root'));
