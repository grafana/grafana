# Releasing

converge is a Go submodule inside the Grafana monorepo:
`github.com/grafana/grafana/pkg/converge`. It is consumed by path, as every
other in-tree module is:

```
// go.mod
require github.com/grafana/grafana/pkg/converge v0.0.0
replace github.com/grafana/grafana/pkg/converge => ./pkg/converge
```

There is no version to bump. A fix reaches a release branch as a source
cherry-pick, exactly as any other change to the tree does — which in this
repository is markedly cheaper than a dependency bump, because a bump drags a
transitive graph across every module in the workspace and a cherry-pick drags
nothing.

## Why it is shaped like a separate library anyway

Two reasons, and neither is "so we can version it".

**A compile-time boundary.** The planner's purity is the property every
guarantee rests on. A separate module makes it impossible to reach into the
rest of the tree for a logger, a clock or a connection — which is how a pure
function quietly stops being one.

**Optionality.** If a second consumer appears, promotion to its own repository
is a history filter and a tag, not a rewrite. Keeping the dependency set empty
is what preserves that: a module with no third-party requirements bumps into
any release branch as two lines, while one carrying Kubernetes or logging
dependencies does not.

## If it does move out

1. Keep the dependency set empty. The moment it needs a logging library, a
   test framework or an API type, the cheap-bump property is gone.
2. Give it release branches before the first consumer pins it. Without them a
   fix cannot reach an old consumer without also carrying everything else that
   landed on main.
3. Rewrite the import path and nothing else. The package has no internal
   dependencies on the monorepo.
