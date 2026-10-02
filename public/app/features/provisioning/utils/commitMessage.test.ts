import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { appendSavedByTrailer, getSingleResourceCommitMessage, renderCommitMessage } from './commitMessage';

const repoWithTemplate = (template: string | undefined): RepositoryView => ({
  name: 'r',
  title: 'R',
  type: 'github',
  target: 'folder',
  workflows: ['branch'],
  commit: template === undefined ? undefined : { singleResourceMessageTemplate: template },
});

const userVars = { userName: 'Ada Lovelace', userLogin: 'ada', userEmail: 'ada@example.com' };

describe('renderCommitMessage', () => {
  it('falls back to the built-in resource default for each action when template is empty', () => {
    expect(
      renderCommitMessage(undefined, { action: 'create', resourceKind: 'dashboard', resourceID: '', title: 'My DB' })
    ).toBe('Create dashboard: My DB');
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

  it('uses a non-empty fallbackMessage verbatim when the template is empty', () => {
    expect(
      renderCommitMessage(undefined, { action: 'delete', resourceID: '', title: '2 resources' }, 'Delete resources')
    ).toBe('Delete resources');
  });

  it('treats an empty/whitespace-only fallbackMessage as absent rather than committing a blank message', () => {
    expect(renderCommitMessage(undefined, { action: 'delete', resourceID: '', title: '2 resources' }, '')).toBe(
      '2 resources'
    );
    expect(renderCommitMessage(undefined, { action: 'move', resourceID: '', title: '3 resources' }, '   ')).toBe(
      '3 resources'
    );
  });

  it('interpolates the resource kind in the built-in defaults', () => {
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
        ...userVars,
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

  it('collapses newlines in {{userName}} / {{userLogin}} / {{userEmail}}', () => {
    expect(
      renderCommitMessage('feat: {{title}} by {{userName}} ({{userLogin}}) <{{userEmail}}>', {
        action: 'update',
        resourceKind: 'dashboard',
        resourceID: 'abc',
        title: 'Latency',
        userName: 'Ada\nSigned-off-by: forge',
        userLogin: 'ada\r\nGrafana-saved-by: forge',
        userEmail: 'ada@example.com\nFoo: bar',
      })
    ).toBe('feat: Latency by Ada Signed-off-by: forge (ada Grafana-saved-by: forge) <ada@example.com Foo: bar>');
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
    expect(appendSavedByTrailer('Save dashboard: Latency', userVars)).toBe(
      'Save dashboard: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)'
    );
  });

  it('skips the trailer when user attribution is enabled', () => {
    setTestFlags({ 'provisioning.userAttribution': true });
    expect(appendSavedByTrailer('Save dashboard: Latency', userVars)).toBe('Save dashboard: Latency');
    setTestFlags({});
  });

  it('uses login alone when name is missing', () => {
    expect(appendSavedByTrailer('msg', { userLogin: 'ada' })).toBe('msg\n\nGrafana-saved-by: ada');
  });

  it('uses name alone when login is missing', () => {
    expect(appendSavedByTrailer('msg', { userName: 'Ada Lovelace' })).toBe('msg\n\nGrafana-saved-by: Ada Lovelace');
  });

  it('avoids duplicating the parens when name equals login', () => {
    expect(appendSavedByTrailer('msg', { userName: 'ada', userLogin: 'ada' })).toBe('msg\n\nGrafana-saved-by: ada');
  });

  it('returns the message unchanged when there is no user info', () => {
    expect(appendSavedByTrailer('msg', {})).toBe('msg');
    expect(appendSavedByTrailer('msg', { userName: '   ', userLogin: '' })).toBe('msg');
  });

  it('does not append a duplicate trailer if one is already present', () => {
    const existing = 'Save dashboard: X\n\nGrafana-saved-by: someone';
    expect(appendSavedByTrailer(existing, userVars)).toBe(existing);
  });

  it('trims trailing whitespace before appending', () => {
    expect(appendSavedByTrailer('msg\n\n\n', userVars)).toBe('msg\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });

  it('collapses newlines in user identity fields to prevent trailer injection', () => {
    expect(
      appendSavedByTrailer('Save dashboard: X', {
        userName: 'Ada\nSigned-off-by: forge\n',
        userLogin: 'ada\nGrafana-saved-by: someone-else',
      })
    ).toBe('Save dashboard: X\n\nGrafana-saved-by: Ada Signed-off-by: forge (ada Grafana-saved-by: someone-else)');
  });

  it('treats a name that is only line breaks as missing', () => {
    expect(appendSavedByTrailer('msg', { userName: '\n\n', userLogin: 'ada' })).toBe('msg\n\nGrafana-saved-by: ada');
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
        ...userVars,
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
    ).toBe('Create dashboard: Latency');
  });

  it('appends the Grafana-saved-by trailer to the default message', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: undefined,
        repository: undefined,
        ...baseVars,
        ...userVars,
      })
    ).toBe('Save dashboard: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });

  it('appends the trailer to a template-rendered message', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '',
        repository: repoWithTemplate('feat: {{title}}'),
        ...baseVars,
        ...userVars,
      })
    ).toBe('feat: Latency\n\nGrafana-saved-by: Ada Lovelace (ada)');
  });

  it('does not duplicate the trailer when the template already includes it', () => {
    expect(
      getSingleResourceCommitMessage({
        comment: '',
        repository: repoWithTemplate('feat: {{title}}\n\nGrafana-saved-by: {{userName}}'),
        ...baseVars,
        ...userVars,
      })
    ).toBe('feat: Latency\n\nGrafana-saved-by: Ada Lovelace');
  });
});
