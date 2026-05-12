import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { getSingleResourceCommitMessage, renderCommitMessage } from './commitMessage';

const repoWithTemplate = (template: string | undefined): RepositoryView => ({
  name: 'r',
  title: 'R',
  type: 'github',
  target: 'folder',
  workflows: ['branch'],
  commit: template === undefined ? undefined : { singleResourceMessageTemplate: template },
});

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
    expect(
      renderCommitMessage(undefined, { action: 'rename', resourceKind: 'dashboard', resourceID: 'abc', title: 'My DB' })
    ).toBe('Rename dashboard: My DB');
  });

  it('falls back to folder defaults for folder resources', () => {
    expect(
      renderCommitMessage(undefined, { action: 'create', resourceKind: 'folder', resourceID: '', title: 'ops' })
    ).toBe('Create folder: ops');
    expect(
      renderCommitMessage(undefined, { action: 'rename', resourceKind: 'folder', resourceID: 'uid', title: 'ops' })
    ).toBe('Rename folder: ops');
    expect(
      renderCommitMessage(undefined, { action: 'delete', resourceKind: 'folder', resourceID: 'uid', title: 'ops' })
    ).toBe('Delete folder: ops');
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

describe('getSingleResourceCommitMessage', () => {
  const baseVars = {
    action: 'update' as const,
    resourceKind: 'dashboard' as const,
    resourceID: 'abc',
    title: 'Latency',
  };

  it('uses a non-empty user comment verbatim', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: 'My commit message',
        repository: repoWithTemplate('feat: {{title}}'),
        ...baseVars,
      })
    ).toBe('My commit message');
  });

  it('trims surrounding whitespace from the comment', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '  My note  ',
        repository: repoWithTemplate(undefined),
        ...baseVars,
      })
    ).toBe('My note');
  });

  it('treats whitespace-only comment as empty and falls back to the template', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '   ',
        repository: repoWithTemplate('feat: {{title}}'),
        ...baseVars,
      })
    ).toBe('feat: Latency');
  });

  it('falls back to the built-in default when no comment and no template are set', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '',
        repository: repoWithTemplate(undefined),
        ...baseVars,
      })
    ).toBe('Save dashboard: Latency');
  });

  it('handles an undefined repository (no template available)', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: undefined,
        repository: undefined,
        ...baseVars,
        action: 'create',
      })
    ).toBe('New dashboard: Latency');
  });
});
