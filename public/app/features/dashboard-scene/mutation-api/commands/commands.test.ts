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

  it('every command has a Zod payload schema with safeParse', () => {
    for (const cmd of ALL_COMMANDS) {
      expect(cmd.payloadSchema).toBeDefined();
      expect(typeof cmd.payloadSchema.safeParse).toBe('function');
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
      if (
        cmd.name === 'LIST_VARIABLES' ||
        cmd.name === 'LIST_ANNOTATIONS' ||
        cmd.name === 'ENTER_EDIT_MODE' ||
        cmd.name === 'GET_LAYOUT' ||
        cmd.name === 'LIST_PANELS' ||
        cmd.name === 'GET_DASHBOARD_INFO'
      ) {
        const result = cmd.payloadSchema.safeParse({});
        expect(result.success).toBe(true);
      }
    }
  });

  // Not decoration: the client reads readOnly to decide whether to forceRender after a command and
  // whether to deep-clone the payload. A write marked read-only would apply a spec and never repaint.
  it('marks the full-spec reads read-only and the writes not', () => {
    const readOnlyByName = Object.fromEntries(
      ALL_COMMANDS.filter((cmd) => cmd.name.includes('SPEC')).map((cmd) => [cmd.name, cmd.readOnly ?? false])
    );

    expect(readOnlyByName).toEqual({
      GET_SPEC: true,
      GET_NOTEBOOK_SPEC: true,
      APPLY_SPEC: false,
      APPLY_NOTEBOOK_SPEC: false,
    });
  });

  it('registers the expected set of commands', () => {
    const names = ALL_COMMANDS.map((cmd) => cmd.name).sort();
    expect(names).toEqual([
      'ADD_ANNOTATION',
      'ADD_PANEL',
      'ADD_ROW',
      'ADD_TAB',
      'ADD_VARIABLE',
      'APPLY_NOTEBOOK_SPEC',
      'APPLY_SPEC',
      'ENTER_EDIT_MODE',
      'GET_DASHBOARD_INFO',
      'GET_LAYOUT',
      'GET_NOTEBOOK_SPEC',
      'GET_SPEC',
      'LIST_ANNOTATIONS',
      'LIST_PANELS',
      'LIST_VARIABLES',
      'MOVE_PANEL',
      'MOVE_ROW',
      'MOVE_TAB',
      'REMOVE_ANNOTATION',
      'REMOVE_PANEL',
      'REMOVE_ROW',
      'REMOVE_TAB',
      'REMOVE_VARIABLE',
      'UPDATE_ANNOTATION',
      'UPDATE_DASHBOARD_SETTINGS',
      'UPDATE_LAYOUT',
      'UPDATE_PANEL',
      'UPDATE_ROW',
      'UPDATE_TAB',
      'UPDATE_VARIABLE',
    ]);
  });
});
