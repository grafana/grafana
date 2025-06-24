// See ./index.ts for why this is in a seperate file

// Trusted types must be initialised before the rest of the world is imported
import './core/trustedTypePolicies';
import app from './app';

app.init();
