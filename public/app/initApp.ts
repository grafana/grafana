console.log('initApp running');

import './core/trustedTypePolicies';

console.log('Importing app');
import app from './app';

console.log('Initializing app');
app.init();
console.log('App initialized');
