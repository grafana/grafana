import Handlebars from 'handlebars';

import { createNonceCompiler } from './compiler';
import { createTemplateHelpers } from './helpers';
import {
  helperKey,
  isHelperCall,
  isRecord,
  isRenderRequest,
  MAX_OUTPUT_CHARS,
  MAX_ERROR_CHARS,
  MAX_MESSAGE_CHARS,
  PROTOCOL,
  type HelperCall,
  type HelperValue,
} from './protocol';

const bootstrap = document.currentScript;
if (!(bootstrap instanceof HTMLScriptElement)) {
  throw new Error('Template runtime requires its bootstrap script');
}
const nonce = bootstrap.nonce;
const channel = bootstrap.dataset.channel!;
const parentOrigin = bootstrap.dataset.parentOrigin!;
bootstrap.remove();
const env = Handlebars.create();
let helpers = new Map<string, HelperValue>();

class MissingHelper {
  constructor(readonly call: HelperCall) {}
}

env.registerHelper(
  createTemplateHelpers((name, args) => {
    // Invalid date inputs return empty text, as in the host helper; objects cannot become host capabilities.
    const normalized =
      name === 'date'
        ? args.map((arg) =>
            arg === undefined ||
            arg === null ||
            arg instanceof Date ||
            typeof arg === 'string' ||
            typeof arg === 'number'
              ? arg
              : null
          )
        : args;
    const call = { name, args: normalized };
    if (!isHelperCall(call)) {
      throw new Error('Template helper arguments exceed the supported limits');
    }
    const key = helperKey(call);
    if (!helpers.has(key)) {
      throw new MissingHelper(call);
    }
    return helpers.get(key)!;
  })
);
const compiler = createNonceCompiler(env, nonce);

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (
    event.source !== window.parent ||
    event.origin !== parentOrigin ||
    !isRenderRequest(event.data) ||
    event.data.channel !== channel
  ) {
    return;
  }
  const request = event.data;
  const envelope = { protocol: PROTOCOL, channel, id: request.id };
  try {
    if (JSON.stringify(request).length > MAX_MESSAGE_CHARS) {
      throw new Error('Template data exceeds the message limit');
    }
    helpers = new Map(request.helpers);
    let readRows = false;
    if (request.trackRows) {
      const observe = (value: Record<string, unknown>) => {
        const rows = value.data;
        Object.defineProperty(value, 'data', {
          configurable: true,
          get: () => {
            readRows = true;
            return rows;
          },
        });
      };
      observe(request.data);
      if (Array.isArray(request.data.frames)) {
        request.data.frames.filter(isRecord).forEach(observe);
      }
    }
    const result = compiler.render(request.template, request.data);
    if (result.content.length > MAX_OUTPUT_CHARS) {
      throw new Error('Template output exceeds the message limit');
    }
    window.parent.postMessage({ ...envelope, type: 'result', ...result, readRows }, parentOrigin);
  } catch (error) {
    window.parent.postMessage(
      error instanceof MissingHelper
        ? { ...envelope, type: 'helper', call: error.call }
        : { ...envelope, type: 'error', error: String(error).slice(0, MAX_ERROR_CHARS) },
      parentOrigin
    );
  } finally {
    helpers.clear();
  }
});
window.parent.postMessage({ protocol: PROTOCOL, channel, type: 'ready' }, parentOrigin);
