import { type Observable, asapScheduler, map, observeOn } from 'rxjs';

import { CustomVariable, type VariableGetOptionsArgs, type VariableValueOption } from '@grafana/scenes';

// CustomVariable unconditionally sets skipNextValidation = true whenever its interpolated
// query resolves to zero options (scenes PR #1033), intending to protect a value just set
// via initial URL sync before the query has had a chance to resolve real options for the
// first time. But the guard only checks the option count, not whether this variable has
// ever resolved options before, so once a dependency (e.g. a scope-derived value) has
// resolved at least once and later legitimately clears at runtime, the same guard also
// suppresses that reset. This override restores the narrower, originally intended
// condition: only allow the guard while this variable has never resolved a non-empty
// option set. state.options is read before super.getValueOptions() runs, so it reflects
// the previous resolution and survives scene cloning, unlike an instance field would.
export class ResettingCustomVariable extends CustomVariable {
  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const hasResolvedNonEmptyBefore = this.state.options.length > 0;

    if (!hasResolvedNonEmptyBefore) {
      return super.getValueOptions(args);
    }

    return super.getValueOptions(args).pipe(
      // Deferred to a microtask so the reset lands after the synchronous state-change
      // notification it was triggered by has fully unwound. ScopesService notifies its
      // consumers before writing its own URL state, and its URL listener re-applies any
      // scope it still sees in the URL, so resetting synchronously writes var-<name> while
      // the stale scopes param is still present and the removal gets undone. Waiting one
      // microtask lets that URL write land first. DashboardReloadBehavior defers for the
      // same reason. Remove once scopes state management no longer depends on this
      // ordering.
      observeOn(asapScheduler),
      map((options) => {
        if (options.length === 0) {
          this.skipNextValidation = false;
        }
        return options;
      })
    );
  }
}
