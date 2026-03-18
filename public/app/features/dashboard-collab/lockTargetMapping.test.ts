import { getLockTarget } from './lockTargetMapping';
import { MutationRequest } from './protocol/messages';

describe('getLockTarget', () => {
  it.each([
    ['UPDATE_PANEL', { element: { name: 'panel-1' } }, 'panel-1'],
    ['REMOVE_PANEL', { element: { name: 'panel-2' } }, 'panel-2'],
    ['MOVE_PANEL', { element: { name: 'panel-3' } }, 'panel-3'],
  ])('%s → panel lock target', (type, payload, expected) => {
    const mutation: MutationRequest = { type, payload };
    expect(getLockTarget(mutation)).toBe(expected);
  });

  it('ADD_PANEL → no lock', () => {
    const mutation: MutationRequest = { type: 'ADD_PANEL', payload: {} };
    expect(getLockTarget(mutation)).toBe('');
  });

  it.each(['ADD_VARIABLE', 'UPDATE_VARIABLE', 'REMOVE_VARIABLE'])(
    '%s → __variables__',
    (type) => {
      const mutation: MutationRequest = { type, payload: {} };
      expect(getLockTarget(mutation)).toBe('__variables__');
    }
  );

  it.each([
    'ADD_ROW',
    'REMOVE_ROW',
    'UPDATE_ROW',
    'MOVE_ROW',
    'ADD_TAB',
    'REMOVE_TAB',
    'UPDATE_TAB',
    'MOVE_TAB',
    'UPDATE_LAYOUT',
  ])('%s → __layout__', (type) => {
    const mutation: MutationRequest = { type, payload: {} };
    expect(getLockTarget(mutation)).toBe('__layout__');
  });

  it('UPDATE_DASHBOARD_INFO → __dashboard__', () => {
    const mutation: MutationRequest = { type: 'UPDATE_DASHBOARD_INFO', payload: {} };
    expect(getLockTarget(mutation)).toBe('__dashboard__');
  });

  it('unknown type → empty string', () => {
    const mutation: MutationRequest = { type: 'UNKNOWN_COMMAND', payload: {} };
    expect(getLockTarget(mutation)).toBe('');
  });

  it('missing element returns empty string', () => {
    const mutation: MutationRequest = { type: 'UPDATE_PANEL', payload: {} };
    expect(getLockTarget(mutation)).toBe('');
  });
});
