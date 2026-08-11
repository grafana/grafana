import { setTestFlags } from '@grafana/test-utils/unstable';
import { DASHBOARD_COMMANDS } from 'app/features/dashboard-scene/mutation-api';

import { NotebookMutationClient } from './NotebookMutationClient';
import { NOTEBOOKS_FLAG, notebookScene } from './test-utils';

// The point of these: "one command, one spec" is a property of which commands are registered where,
// not a check inside any command. If a dashboard command ever became reachable on a notebook, it would
// serialize the notebook through the dashboard serializer and silently drop every narrative cell.
describe('NotebookMutationClient', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('exposes exactly the notebook commands', () => {
    const client = new NotebookMutationClient(notebookScene());

    expect(client.getAvailableCommands().sort()).toEqual([
      'APPLY_NOTEBOOK_SPEC',
      'CREATE_NOTEBOOK_SPEC',
      'GET_NOTEBOOK_SPEC',
    ]);
  });

  it('does not expose any dashboard command', () => {
    const available = new Set(new NotebookMutationClient(notebookScene()).getAvailableCommands());

    for (const cmd of DASHBOARD_COMMANDS) {
      expect(available.has(cmd.name)).toBe(false);
    }
  });

  it('names the available commands when asked for one that is not here', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'GET_SPEC', payload: {} });

    // A caller aimed at the wrong document learns both that it guessed wrong and what to send instead.
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type: GET_SPEC');
    expect(result.error).toContain('GET_NOTEBOOK_SPEC');
  });

  it('accepts a lower-case command type', async () => {
    const client = new NotebookMutationClient(notebookScene());

    const result = await client.execute({ type: 'get_notebook_spec', payload: {} });

    expect(result.success).toBe(true);
  });
});
