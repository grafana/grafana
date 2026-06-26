#!/bin/sh

# Catch devs who have installed lefthook, went back into the past and reinstalled husky,
# then came back into lefthook-land.
if [ -f ".git/hooks/pre-commit" ]; then
  if grep -q lefthook ".git/hooks/pre-commit"; then
    # Remove husky from their git config
    env SILENT=1 ./scripts/cleanup-husky.sh

    # And run the lefthook precommit hook instead of this
    ./.git/hooks/pre-commit "$@"
    exit $?
  fi
fi

# This precommit hook exists only for people who still have hooksPath=.husky in their git config
# from when we used husky. This is intended to run only on first commit after pulling the lefthook changes.
#
# Either setting up lefthook, or running the clean command will unset the hooksPath git config so this
# hook is no longer ran when committing.

echo "\n⚠️⚠️⚠️ Important: Pre-commit hooks are now opt-in. ⚠️⚠️⚠️"
echo "To install the new pre-commit hooks:"
echo "  $ make lefthook-install"
echo "Or, silence this message by cleaning up the old hooks"
echo "  $ make cleanup-old-git-hooks"
echo "\nPre-commit hooks will not run on this commit and it will be committed even if it contains lint errors."
echo "See https://github.com/grafana/grafana/blob/main/contribute/developer-guide.md#configure-precommit-hooks for more info\n"

exit 0
