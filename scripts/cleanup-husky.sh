#!/usr/bin/env bash
set -e

currentHooksPath=$(git config core.hooksPath || true)

if [[ $currentHooksPath == ".husky" ]]; then
  echo "Unsetting git hooks path because it was previously set to .husky."
  echo "If you had custom git hooks in .husky you may want to move them to .git/hooks"
  git config --unset core.hooksPath
fi

oldHuskyHookNames=(
  "applypatch-msg"
  "commit-msg"
  "post-applypatch"
  "post-checkout"
  "post-commit"
  "post-merge"
  "post-receive"
  "post-rewrite"
  "post-update"
  "pre-applypatch"
  "pre-auto-gc"
  "pre-merge-commit"
  "pre-push"
  "pre-rebase"
  "pre-receive"
  "push-to-checkout"
  "sendemail-validate"
  "update"
)

for hookName in "${oldHuskyHookNames[@]}"; do
  hookPath=".git/hooks/$hookName"

  if [[ -f $hookPath ]]; then
    if grep -q husky "$hookPath"; then
      newHookPath="$hookPath.old"
      echo "Renaming old husky hook $hookPath to $newHookPath"
      mv "$hookPath" "$newHookPath" --suffix=old --backup=numbered
    fi
  fi
done
