import {
  isQueryCoauthoringEditorHost,
  type QueryCoauthoringEditorHost,
  isQueryCoauthoringEditorHandle,
  type QueryCoauthoringEditorHandle,
  isQueryCoauthoringSession,
  type QueryCoauthoringSession,
  isQueryCoauthoringAPI,
  isQueryCoauthoringLanguage,
  type QueryCoauthoringAPI,
  type QueryCoauthoringLanguage,
} from './queryCoauthoringContracts';

describe('isQueryCoauthoringAPI', () => {
  const api = {
    version: 1,
    onEnterRequested: jest.fn(),
    onResumeRequested: jest.fn(),
    canEnter: jest.fn(),
    enter: jest.fn(),
  } satisfies QueryCoauthoringAPI;

  it('recognizes the supported entry point without invoking it', () => {
    expect(isQueryCoauthoringAPI(api)).toBe(true);
    expect(api.enter).not.toHaveBeenCalled();
    expect(api.canEnter).not.toHaveBeenCalled();
    expect(api.onEnterRequested).not.toHaveBeenCalled();
    expect(api.onResumeRequested).not.toHaveBeenCalled();
  });

  it.each(['onEnterRequested', 'onResumeRequested', 'canEnter', 'enter'])('rejects a missing %s', (member) => {
    expect(isQueryCoauthoringAPI({ ...api, [member]: undefined })).toBe(false);
    expect(isQueryCoauthoringAPI({ ...api, [member]: true })).toBe(false);
  });

  it.each([undefined, null, false, 'api', 1, [], {}, { ...api, version: 2 }, { ...api, version: '1' }])(
    'rejects an invalid or unsupported entry point: %p',
    (value) => {
      expect(isQueryCoauthoringAPI(value)).toBe(false);
    }
  );
});

describe('isQueryCoauthoringLanguage', () => {
  const language = {
    version: 1,
    describe: jest.fn(),
    prepare: jest.fn(),
  } satisfies QueryCoauthoringLanguage;

  it('recognizes the supported language without executing datasource code', () => {
    expect(isQueryCoauthoringLanguage(language)).toBe(true);
    expect(language.describe).not.toHaveBeenCalled();
    expect(language.prepare).not.toHaveBeenCalled();
  });

  it.each(['describe', 'prepare'])('rejects a missing or non-callable %s', (member) => {
    expect(isQueryCoauthoringLanguage({ ...language, [member]: undefined })).toBe(false);
    expect(isQueryCoauthoringLanguage({ ...language, [member]: 'function' })).toBe(false);
  });

  it.each([undefined, null, false, 'language', 1, [], {}, { ...language, version: 2 }, { ...language, version: '1' }])(
    'rejects an invalid or unsupported language: %p',
    (value) => {
      expect(isQueryCoauthoringLanguage(value)).toBe(false);
    }
  );
});

describe('isQueryCoauthoringEditorHost', () => {
  const host = { version: 1, register: jest.fn(), invoke: jest.fn() } satisfies QueryCoauthoringEditorHost;

  it('recognizes the supported host without registering or invoking an editor', () => {
    expect(isQueryCoauthoringEditorHost(host)).toBe(true);
    expect(host.register).not.toHaveBeenCalled();
    expect(host.invoke).not.toHaveBeenCalled();
  });

  it.each(['register', 'invoke'])('rejects a missing or non-callable %s', (member) => {
    expect(isQueryCoauthoringEditorHost({ ...host, [member]: undefined })).toBe(false);
    expect(isQueryCoauthoringEditorHost({ ...host, [member]: {} })).toBe(false);
  });

  it.each([undefined, null, false, 'host', 1, [], {}, { ...host, version: 2 }, { ...host, version: '1' }])(
    'rejects an invalid or unsupported host: %p',
    (value) => {
      expect(isQueryCoauthoringEditorHost(value)).toBe(false);
    }
  );
});

describe('isQueryCoauthoringEditorHandle', () => {
  const handle = { version: 1, getSelection: jest.fn(), subscribe: jest.fn() } satisfies QueryCoauthoringEditorHandle;

  it('accepts an editor without optional change marks without reading its selection', () => {
    expect(isQueryCoauthoringEditorHandle(handle)).toBe(true);
    expect(handle.getSelection).not.toHaveBeenCalled();
    expect(handle.subscribe).not.toHaveBeenCalled();
  });

  it('accepts optional change marks without displaying them', () => {
    const showChanges = jest.fn();
    expect(isQueryCoauthoringEditorHandle({ ...handle, showChanges })).toBe(true);
    expect(showChanges).not.toHaveBeenCalled();
  });

  it.each(['getSelection', 'subscribe'])('rejects a missing or non-callable %s', (member) => {
    expect(isQueryCoauthoringEditorHandle({ ...handle, [member]: undefined })).toBe(false);
    expect(isQueryCoauthoringEditorHandle({ ...handle, [member]: [] })).toBe(false);
  });

  it.each([null, false, 'showChanges', {}])('rejects malformed optional change marks: %p', (showChanges) => {
    expect(isQueryCoauthoringEditorHandle({ ...handle, showChanges })).toBe(false);
  });

  it.each([undefined, null, false, 'handle', 1, [], {}, { ...handle, version: 2 }, { ...handle, version: '1' }])(
    'rejects an invalid or unsupported handle: %p',
    (value) => {
      expect(isQueryCoauthoringEditorHandle(value)).toBe(false);
    }
  );
});

describe('isQueryCoauthoringSession', () => {
  const session = {
    version: 1,
    signal: new AbortController().signal,
    closed: new Promise<never>(() => {}),
    getState: jest.fn(),
    subscribe: jest.fn(),
    stageProposal: jest.fn(),
    preview: jest.fn(),
    accept: jest.fn(),
    undo: jest.fn(),
    select: jest.fn(),
    exit: jest.fn(),
  } satisfies QueryCoauthoringSession;

  it('recognizes the supported session without calling its operations', () => {
    expect(isQueryCoauthoringSession(session)).toBe(true);
    for (const operation of [
      session.getState,
      session.subscribe,
      session.stageProposal,
      session.preview,
      session.accept,
      session.undo,
      session.select,
      session.exit,
    ]) {
      expect(operation).not.toHaveBeenCalled();
    }
  });

  it.each(['getState', 'subscribe', 'stageProposal', 'preview', 'accept', 'undo', 'select', 'exit'])(
    'rejects a missing or non-callable %s',
    (member) => {
      expect(isQueryCoauthoringSession({ ...session, [member]: undefined })).toBe(false);
      expect(isQueryCoauthoringSession({ ...session, [member]: true })).toBe(false);
    }
  );

  it.each([
    undefined,
    null,
    {},
    { aborted: false },
    { aborted: false, addEventListener: jest.fn() },
    { aborted: 'false', addEventListener: jest.fn(), removeEventListener: jest.fn() },
  ])('rejects a malformed abort signal: %p', (signal) => {
    expect(isQueryCoauthoringSession({ ...session, signal })).toBe(false);
  });

  it.each([undefined, null, {}, { then: true }, { then: jest.fn() }, { then: jest.fn(), catch: jest.fn() }])(
    'rejects a malformed close promise: %p',
    (closed) => {
      expect(isQueryCoauthoringSession({ ...session, closed })).toBe(false);
    }
  );

  it.each([undefined, null, false, 'session', 1, [], {}, { ...session, version: 2 }, { ...session, version: '1' }])(
    'rejects an invalid or unsupported session: %p',
    (value) => {
      expect(isQueryCoauthoringSession(value)).toBe(false);
    }
  );
});
