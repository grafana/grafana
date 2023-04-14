/// @ts-check
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let changedHooksPath = false;

const oldHuskyHooks = [
  'applypatch-msg',
  'commit-msg',
  'post-applypatch',
  'post-checkout',
  'post-commit',
  'post-merge',
  'post-receive',
  'post-rewrite',
  'post-update',
  'pre-applypatch',
  'pre-auto-gc',
  'pre-merge-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'push-to-checkout',
  'sendemail-validate',
  'update',
];

//
// Husky's postinstall script changes your local repo git config, so undo those changes.
// Still respect the setting though if it's been set to something else.
const hooksConfig = childProcess.spawnSync('git', ['config', 'core.hooksPath'], { encoding: 'utf-8' });
if (hooksConfig.stdout.trim() === '.husky') {
  childProcess.spawnSync('git', ['config', '--unset', 'core.hooksPath'], { encoding: 'utf-8' });
  changedHooksPath = true;
}

//
// Previous version of husky also installed its hooks into .git/hooks which we now need to
// clean up. We'll just rename them to .old so nothing is lost permanently.
if (changedHooksPath) {
  for (const hookFileName of oldHuskyHooks) {
    const hookPath = path.join('.git', 'hooks', hookFileName);
    try {
      // Only rename the hook if it looks like a husky hook
      const hookContents = fs.readFileSync(hookPath).toString();
      if (!hookContents.includes('husky')) {
        continue;
      }

      fs.renameSync(hookPath, hookPath + '.old');
    } catch (err) {
      // Don't log an error if it's just the "file not exists" error
      if (err.code !== 'ENOENT') {
        console.error(`Error cleaning up old hook ${hookPath}: ${err.message ?? err} `);
      }
    }
  }
}

//
// Leave a helpful message in the old .husky directory.
// We don't delete this directory for them in case they've added their own git hooks.
try {
  const message = [
    `This directory is no longer used for git hooks and is safe to delete if you want to.`,
    `If you've added custom git hooks in here, be sure to move them to the .git/hooks directory.`,
  ].join('\n\n');
  fs.writeFileSync('./.husky/safe-to-delete', message);
} catch {
  // This will throw an exception if the .husky folder doesn't exist, so just ignore any error
}
