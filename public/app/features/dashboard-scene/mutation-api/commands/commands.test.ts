import { safeParse } from 'valibot';

import { ALL_COMMANDS } from './registry';

describe('Command consistency', () => {
  it('every command has an UPPER_CASE name', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(cmd.name).toMatch(/^[A-Z_]+$/);
    }
  });

  it('every command has a non-empty description', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  it('every command has a valibot payload schema', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(cmd.payloadSchema).toBeDefined();
      expect(safeParse(cmd.payloadSchema, {})).toBeDefined();
    }
  });

  it('every command has a permission check function', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(typeof cmd.permission).toBe('function');
    }
  });

  it('every command has a handler function', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(typeof cmd.handler).toBe('function');
    }
  });

  it('payload schemas accept empty objects for commands that require no fields', () => {
    for (const cmd of ALL_COMMANDS) {
      if (cmd.name === 'LIST_VARIABLES' || cmd.name === 'ENTER_EDIT_MODE' || cmd.name === 'GET_LAYOUT') {
        const result = safeParse(cmd.payloadSchema, {});
        expect(result.success).toBe(true);
      }
    }
  });

  it('registers the expected set of commands', () => {
    const names = ALL_COMMANDS.map((cmd) => cmd.name).sort();
    expect(names).toEqual([
      'ADD_ROW',
      'ADD_TAB',
      'ADD_VARIABLE',
      'ENTER_EDIT_MODE',
      'GET_LAYOUT',
      'LIST_VARIABLES',
      'MOVE_PANEL',
      'MOVE_ROW',
      'MOVE_TAB',
      'REMOVE_ROW',
      'REMOVE_TAB',
      'REMOVE_VARIABLE',
      'UPDATE_LAYOUT',
      'UPDATE_ROW',
      'UPDATE_TAB',
      'UPDATE_VARIABLE',
    ]);
  });
});
