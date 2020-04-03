import { Emitter } from './utils/emitter';
import { setAppEvents } from '@grafana/runtime';

export const appEvents = new Emitter();

// Expose the emitter to plugins
setAppEvents(appEvents);

export default appEvents;
