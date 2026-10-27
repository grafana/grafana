import { type HelperResolver } from './helpers';
import {
  helperKey,
  isHelperValue,
  isNotification,
  isRecord,
  MAX_HELPERS,
  MAX_MESSAGE_CHARS,
  MAX_TEMPLATE_CHARS,
  PROTOCOL,
  type HelperValue,
  type TemplateInput,
  type TemplateResult,
} from './protocol';
import runtimeSource from './runtime?text-panel-runtime';

let shellPolicy: Pick<TrustedTypePolicy, 'createHTML'> | undefined;
const abortError = () => new DOMException('Template render cancelled', 'AbortError');

export function createTemplateSandbox(
  nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || crypto.randomUUID().replaceAll('-', ''),
  timeout = 5000
) {
  if (!/^[a-zA-Z0-9+/_=-]+$/.test(nonce)) {
    throw new Error('Invalid template frame nonce');
  }
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.title = 'Text template execution';
  frame.sandbox.add('allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  const channel = crypto.randomUUID();
  const pending = new Map<
    number,
    {
      input: TemplateInput;
      helpers: Map<string, HelperValue>;
      resolveHelper: HelperResolver;
      resolve: (result: TemplateResult) => void;
      reject: (error: Error) => void;
      clean: () => void;
      calls: number;
    }
  >();
  let nextId = 0;
  let disposed = false;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // A caller can unmount while the lazy bundle initializes, before it awaits readiness.
  void ready.catch(() => {});
  const readyTimer = window.setTimeout(() => dispose(new Error('Template frame did not initialize')), timeout);

  function finish(id: number, error?: Error, result?: TemplateResult) {
    const request = pending.get(id);
    if (!request) {
      return;
    }
    pending.delete(id);
    request.clean();
    if (error) {
      request.reject(error);
    } else if (result) {
      request.resolve(result);
    }
  }
  function send(id: number) {
    const request = pending.get(id);
    if (!request) {
      return;
    }
    try {
      const message = {
        ...request.input,
        protocol: PROTOCOL,
        channel,
        type: 'render',
        id,
        helpers: Array.from(request.helpers),
      };
      if (JSON.stringify(message).length > MAX_MESSAGE_CHARS) {
        throw new Error('Template data exceeds the message limit');
      }
      frame.contentWindow!.postMessage(message, '*');
    } catch (error) {
      finish(id, error instanceof Error ? error : new Error(String(error)));
    }
  }
  function onMessage(event: MessageEvent<unknown>) {
    if (
      disposed ||
      event.source !== frame.contentWindow ||
      event.origin !== 'null' ||
      !isNotification(event.data) ||
      event.data.channel !== channel
    ) {
      return;
    }
    const message = event.data;
    if (message.type === 'ready') {
      clearTimeout(readyTimer);
      resolveReady();
      return;
    }
    const request = pending.get(message.id);
    if (!request) {
      return;
    }
    if (message.type === 'result') {
      finish(message.id, undefined, {
        content: message.content,
        readRows: message.readRows,
        compilations: message.compilations,
      });
    } else if (message.type === 'error') {
      finish(message.id, new Error(message.error));
    } else {
      try {
        const key = helperKey(message.call);
        if (++request.calls > MAX_HELPERS || request.helpers.size >= MAX_HELPERS || request.helpers.has(key)) {
          throw new Error('Template helper resolution limit exceeded');
        }
        const value = request.resolveHelper(message.call.name, message.call.args);
        if (!isHelperValue(value)) {
          throw new Error('Template helper result exceeds the message limit');
        }
        request.helpers.set(key, value);
        send(message.id);
      } catch (error) {
        finish(message.id, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
  function dispose(error = new Error('Template frame disposed')) {
    if (disposed) {
      return;
    }
    disposed = true;
    clearTimeout(readyTimer);
    rejectReady(error);
    window.removeEventListener('message', onMessage);
    frame.remove();
    for (const id of pending.keys()) {
      finish(id, error);
    }
  }
  window.addEventListener('message', onMessage);
  try {
    const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    const policy = `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
    const shell = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${escape(policy)}"><script nonce="${nonce}" data-channel="${channel}" data-parent-origin="${escape(window.location.origin)}">${runtimeSource.replace(/<\/script/gi, '<\\/script')}</script>`;
    shellPolicy ??= window.trustedTypes?.createPolicy('grafana-text-template-shell', {
      createHTML: (html: string) => html,
    });
    Object.assign(frame, { srcdoc: shellPolicy?.createHTML(shell) ?? shell });
    document.body.append(frame);
  } catch (error) {
    dispose(error instanceof Error ? error : new Error(String(error)));
  }

  return {
    frame,
    ready,
    dispose,
    get disposed() {
      return disposed;
    },
    async render(
      input: TemplateInput,
      resolveHelper: HelperResolver,
      signal?: AbortSignal,
      helpers = new Map<string, HelperValue>()
    ): Promise<TemplateResult> {
      if (typeof input.template !== 'string' || input.template.length > MAX_TEMPLATE_CHARS || !isRecord(input.data)) {
        throw new Error('Invalid template request');
      }
      if (signal?.aborted) {
        throw abortError();
      }
      await ready;
      if (signal?.aborted) {
        throw abortError();
      }
      if (disposed) {
        throw new Error('Template frame disposed');
      }
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const abort = () => finish(id, abortError());
        const timer = window.setTimeout(() => dispose(new Error('Template render timed out')), timeout);
        pending.set(id, {
          input,
          helpers,
          resolveHelper,
          resolve,
          reject,
          calls: 0,
          clean: () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
          },
        });
        signal?.addEventListener('abort', abort, { once: true });
        send(id);
      });
    },
  };
}
