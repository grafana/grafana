import { type Observable, asapScheduler, observeOn, of, switchMap, tap } from 'rxjs';

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

    const options$ = super.getValueOptions(args);

    if (!hasResolvedNonEmptyBefore) {
      return options$;
    }

    return options$.pipe(
      switchMap((options) => {
        // Non-empty resolutions stay synchronous, matching CustomVariable. Only the reset
        // needs deferring, so an ordinary value-to-value change is unaffected.
        if (options.length > 0) {
          return of(options);
        }

        return of(options).pipe(
          // Deferred to a microtask so the reset lands after the synchronous state-change
          // notification that triggered it has fully unwound. ScopesService notifies its
          // consumers before writing its own URL state, and its URL listener re-applies any
          // scope it still sees in the URL, so resetting synchronously writes var-<name>
          // while the stale scopes param is still present and the removal gets undone.
          // Waiting one microtask lets that URL write land first. DashboardReloadBehavior
          // defers for the same reason. Remove once scopes state management no longer
          // depends on this ordering.
          observeOn(asapScheduler),
          tap(() => {
            // Cleared unconditionally, including when the flag was already set before this
            // call. By the time a dependency has resolved once and then gone empty, a value
            // restored from the URL is itself stale: it was written before the dependency
            // cleared. Preserving a pre-existing flag here reinstates that stale value and
            // the reset never lands, which the scopes integration test demonstrates.
            this.skipNextValidation = false;
          })
        );
      })
    );
  }
}
