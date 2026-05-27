import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import {
  appendSavedByTrailer,
  getSingleResourceCommitMessage,
  renderCommitMessage,
  type CommitUser,
} from './commitMessage';

const repoWithTemplate = (template: string | undefined): RepositoryView => ({
  name: 'r',
  title: 'R',
  type: 'github',
  target: 'folder',
  workflows: ['branch'],
  commit: template === undefined ? undefined : { singleResourceMessageTemplate: template },
});

const user: CommitUser = { name: 'Ada Lovelace', login: 'ada', email: 'ada@example.com' };

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

  it('interpolates {{userName}}, {{userLogin}}, {{userEmail}}', () => {
    expect(
      renderCommitMessage('{{action}} {{title}} by {{userName}} <{{userEmail}}> ({{userLogin}})', {
        action: 'update',
        resourceKind: 'dashboard',
        resourceID: 'abc',
        title: 'Latency',
        user,
      })
    ).toBe('update Latency by Ada Lovelace <ada@example.com> (ada)');
  });

  it('replaces user vars with empty string when user is missing', () => {
    expect(
      renderCommitMessage('{{title}} - {{userName}}', {
        action: 'update',
        resourceKind: 'dashboard',
        resourceID: 'abc',
        title: 'A',
      })
    ).toBe('A - ');
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

describe('appendSavedByTrailer', () => {
  it('appends a trailer with name and login', () => {
    expect(appendSavedByTrailer('Save dashboard: Latency', user)).toBe(
      'Save dashboard: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)'
    );
  });

  it('uses login alone when name is missing', () => {
    expect(appendSavedByTrailer('msg', { login: 'ada' })).toBe('msg\n\nGrafana-saved-by: ada');
  });

  it('uses name alone when login is missing', () => {
    expect(appendSavedByTrailer('msg', { name: 'Ada Lovelace' })).toBe('msg\n\nGrafana-saved-by: Ada Lovelace');
  });

  it('avoids duplicating the parens when name equals login', () => {
    expect(appendSavedByTrailer('msg', { name: 'ada', login: 'ada' })).toBe('msg\n\nGrafana-saved-by: ada');
  });

  it('returns the message unchanged when user is undefined or empty', () => {
    expect(appendSavedByTrailer('msg', undefined)).toBe('msg');
    expect(appendSavedByTrailer('msg', { name: '   ', login: '' })).toBe('msg');
  });

  it('does not append a duplicate trailer if one is already present', () => {
    const existing = 'Save dashboard: X\n\nGrafana-saved-by: someone';
    expect(appendSavedByTrailer(existing, user)).toBe(existing);
  });

  it('trims trailing whitespace before appending', () => {
    expect(appendSavedByTrailer('msg\n\n\n', user)).toBe('msg\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });
});

describe('getSingleResourceCommitMessage', () => {
  const baseVars = {
    action: 'update' as const,
    resourceKind: 'dashboard' as const,
    resourceID: 'abc',
    title: 'Latency',
  };

  it('uses a non-empty user comment verbatim (plus trailer)', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: 'My commit message',
        repository: repoWithTemplate('feat: {{title}}'),
        ...baseVars,
        user,
      })
    ).toBe('My commit message\n\nGrafana-saved-by: Ada Lovelace (ada)');
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

  it('appends the Grafana-saved-by trailer to the default message', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: undefined,
        repository: undefined,
        ...baseVars,
        user,
      })
    ).toBe('Save dashboard: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });

  it('appends the trailer to a template-rendered message', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '',
        repository: repoWithTemplate('feat: {{title}}'),
        ...baseVars,
        user,
      })
    ).toBe('feat: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });

  it('does not duplicate the trailer when the template already includes it', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '',
        repository: repoWithTemplate('feat: {{title}}\n\nGrafana-saved-by: {{userName}}'),
        ...baseVars,
        user,
      })
    ).toBe('feat: Latency\n\nGrafana-saved-by: Ada Lovelace');
  });
});
