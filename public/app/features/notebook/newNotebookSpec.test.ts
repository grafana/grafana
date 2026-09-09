import { newNotebookSpec } from './newNotebookSpec';
import { defaultSpec } from './types';

describe('newNotebookSpec', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-08-26T15:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // The default spec's window is `now-6h` to `now`.
  it('resolves the default relative window to the moment the notebook is made', () => {
    const spec = newNotebookSpec();

    expect(spec.timeSettings.from).toBe('2026-08-26T09:00:00.000Z');
    expect(spec.timeSettings.to).toBe('2026-08-26T15:00:00.000Z');
  });

  it('leaves the rest of the spec exactly as the defaults have it', () => {
    const defaults = defaultSpec();
    const spec = newNotebookSpec();

    expect({ ...spec, timeSettings: { ...spec.timeSettings, from: '', to: '' } }).toEqual({
      ...defaults,
      timeSettings: { ...defaults.timeSettings, from: '', to: '' },
    });
  });
});
