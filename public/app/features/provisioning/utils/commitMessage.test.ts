import { renderCommitMessage } from './commitMessage';

describe('renderCommitMessage', () => {
  it('falls back to the legacy hardcoded default when template is empty', () => {
    expect(
      renderCommitMessage(undefined, { action: 'create', resourceKind: 'dashboard', resourceID: '', title: 'My DB' })
    ).toBe('New dashboard: My DB');
    expect(
      renderCommitMessage('', { action: 'update', resourceKind: 'dashboard', resourceID: 'abc', title: 'My DB' })
    ).toBe('Save dashboard: My DB');
    expect(
      renderCommitMessage('   ', { action: 'delete', resourceKind: 'dashboard', resourceID: 'abc', title: 'My DB' })
    ).toBe('Delete dashboard: My DB');
    expect(
      renderCommitMessage(null, { action: 'move', resourceKind: 'dashboard', resourceID: 'abc', title: 'My DB' })
    ).toBe('Move dashboard: My DB');
  });

  it('falls back to folder defaults for folder resources', () => {
    expect(
      renderCommitMessage(undefined, { action: 'create', resourceKind: 'folder', resourceID: '', title: 'ops' })
    ).toBe('Create folder: ops');
    // i18n strings — jest mocks return the default value
    expect(
      renderCommitMessage(undefined, { action: 'rename', resourceKind: 'folder', resourceID: 'uid', title: 'ops' })
    ).toBe('Rename folder');
    expect(
      renderCommitMessage(undefined, { action: 'delete', resourceKind: 'folder', resourceID: 'uid', title: 'ops' })
    ).toBe('Delete folder');
  });

  it('interpolates {{action}}, {{resourceKind}}, {{resourceID}}, {{title}}', () => {
    expect(
      renderCommitMessage('feat({{resourceKind}}s/{{resourceID}}): {{action}} {{title}}', {
        action: 'update',
        resourceKind: 'dashboard',
        resourceID: 'abc-123',
        title: 'Latency',
      })
    ).toBe('feat(dashboards/abc-123): update Latency');
  });

  it('replaces every occurrence of a variable', () => {
    expect(
      renderCommitMessage('{{title}} / {{title}}', {
        action: 'update',
        resourceKind: 'dashboard',
        resourceID: 'abc',
        title: 'A',
      })
    ).toBe('A / A');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(
      renderCommitMessage('{{action}} {{author}}', {
        action: 'create',
        resourceKind: 'folder',
        resourceID: '',
        title: 'x',
      })
    ).toBe('create {{author}}');
  });
});
