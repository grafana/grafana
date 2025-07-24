import { setupWorker } from 'msw/browser';

import allHandlers from '../handlers/all-handlers';

const worker = setupWorker(...allHandlers);

export default worker;
