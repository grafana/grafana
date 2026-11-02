const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const Environment = require('./happy-dom-environment');

function createEnvironment() {
  return new Environment(
    {
      projectConfig: {
        globals: {},
        testEnvironmentOptions: { customExportConditions: ['@grafana-app/source', 'browser'] },
        fakeTimers: {},
        id: 'happy-dom-environment-test',
        rootDir: path.resolve(__dirname, '../..'),
      },
    },
    { console, testPath: __filename, docblockPragmas: {} }
  );
}

test('restores prototype mocks between sequential Jest environments', async () => {
  const first = createEnvironment();
  const originalRect = Object.getOwnPropertyDescriptor(first.global.Element.prototype, 'getBoundingClientRect');
  const originalOffset = Object.getOwnPropertyDescriptor(first.global.HTMLElement.prototype, 'offsetWidth');
  const addedKey = Symbol('test-only prototype property');
  try {
    Object.defineProperty(first.global.Element.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 400 }),
    });
    Object.defineProperty(first.global.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(first.global.Element.prototype, 'clientWidth', {
      configurable: true,
      get: () => 123,
    });
    first.global.Element.prototype[addedKey] = true;
    assert.equal(first.global.document.createElement('span').getBoundingClientRect().width, 400);
    assert.equal(first.global.document.createElement('span').clientWidth, 123);
  } finally {
    await first.teardown();
  }

  const second = createEnvironment();
  try {
    assert.deepEqual(Object.getOwnPropertyDescriptor(second.global.Element.prototype, 'getBoundingClientRect'), originalRect);
    assert.deepEqual(Object.getOwnPropertyDescriptor(second.global.HTMLElement.prototype, 'offsetWidth'), originalOffset);
    const span = second.global.document.createElement('span');
    assert.equal(span.getBoundingClientRect().width, 0);
    assert.equal(span.offsetWidth, 0);
    assert.equal(span.clientWidth, 0);
    assert.equal(addedKey in span, false);
    assert.equal(second.global.document.doctype.name, 'html');
    assert.equal(second.global.happyDOM.settings.enableJavaScriptEvaluation, false);
    assert.equal(second.global.happyDOM.settings.navigation.disableChildFrameNavigation, true);
  } finally {
    await second.teardown();
  }
});
