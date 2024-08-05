import { setupWorker } from 'msw/browser';

import allHandlers from './handlers';

export default setupWorker(...allHandlers);
