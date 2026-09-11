# Accessible folder hierarchy POC evidence

Grafana `13.3.0-local` was started from the `codex/accessible-folder-hierarchy` worktree against a fresh SQLite database. `foldersAppPlatformAPI` and `accessibleFolderHierarchy` were enabled.

Each user has no basic organization role and belongs to exactly one team. Each team has an explicit Edit grant only on its corresponding restricted leaf. Edit was chosen so the leaf is a valid dashboard save destination; neither ancestor received a grant.

| User    | Browse and picker projection         | All other test folders    |
| ------- | ------------------------------------ | ------------------------- |
| `teama` | `restricted / department-a / team-a` | Hidden / normal GET `403` |
| `teamb` | `restricted / department-a / team-b` | Hidden / normal GET `403` |
| `teamc` | `restricted / department-b / team-c` | Hidden / normal GET `403` |

Projected ancestors are expandable but cannot be selected in the save picker. The authorized leaf can be selected. No sibling, unrelated experimental folder, or public folder appeared in any user projection.

During live validation, an initial picker implementation exposed a UX defect: marking navigation ancestors `disabled` also made their expand controls inaccessible. The implementation was corrected so access classification blocks selection without blocking expansion, and the screenshots were recaptured after the fix.

An accessibility audit then exposed invalid `aria-posinset` values because the shared picker was deriving sibling positions from the Browse Redux tree rather than its own projected items. The picker now derives children, sibling counts, and positions from the same projected tree it renders. A final axe-core WCAG A/AA audit of the fully expanded Team C picker reported 0 violations (23 passes, 3 items requiring manual review).

Artifacts:

- `api/verification.json` — health, toggles, provisioned identities, projections, and normal GET status matrix.
- `commands.md` — redacted reproduction command log.
- `accessible-folder-hierarchy-demo.mp4` — 63-second Team A walkthrough of Browse and the dashboard save picker (H.264, 1440×1000).
- `screenshots/01-teama-browse.png`
- `screenshots/02-teama-picker.png`
- `screenshots/03-teamb-browse.png`
- `screenshots/04-teamb-picker.png`
- `screenshots/05-teamc-browse.png`
- `screenshots/06-teamc-picker.png`

Observed permission leaks: none.

Final verification passed the folder-tree Go unit suite, the SQLite folder-tree integration suite (both search modes), 7 frontend suites / 82 tests, TypeScript checking, focused ESLint, and `git diff --check`.

Adversarial security and UX score: **9.3/10**. The remaining deduction is that this is a local POC using basic authentication and a temporary SQLite database rather than a production-like external identity provider and multi-instance deployment.
