#!/bin/bash
set -e

# Checks that a git working tree is clean. Exit 0 if it is, or exit 1 with a list of
# dirty files - including modifications, removals, and untracked+unignored files.

# Primarily intended for ensuring in CI that codegen operations are a no-op/have
# already been performed.

STAT="$(git status --porcelain 2>/dev/null)"
if [ -z "$STAT" ]
then
    exit 0
else
    echo "$STAT"
    exit 1
fi

# For safekeeping, alternative commands that meet a similar goal (in case the
# above approach ends up being problematic)
# 
# List modified/removed files and exit nonzero if any exist:
# git diff --stat --exit-code
#
# List untracked files, and exit nonzero if any exist:
# git ls-files --others --exclude-standard',
# u="$(git ls-files --others --exclude-standard)" && test -z "$u"