# PR ready

Run the repository **Human Review Gates** checklist from `AGENTS.md` for the current branch before any push.

## Do

1. Summarize the working tree and branch diff vs the preferred base (`main`): what changed and why.
2. Confirm focused scope (no drive-by refactors).
3. Confirm tests or lint relevant to the change were run, or state explicitly what still needs to run.
4. Call out any secrets, credentials, or generated noise that should not ship.
5. **Stop before `git push`** unless the user has already given explicit push approval in this conversation.

## Report back

- Ready / not ready verdict
- Checklist bullets with pass/fail
- Exact next command you would run only after approval (do not run push yourself in this command unless already approved)
