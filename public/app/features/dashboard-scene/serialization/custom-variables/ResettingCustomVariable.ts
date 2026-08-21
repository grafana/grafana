import { type Observable, asapScheduler, filter, observeOn, of, switchMap } from 'rxjs';

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
  // Identifies the most recent resolution. A deferred reset from a superseded one must not
  // land, so it carries the generation it was issued for and drops if that is no longer
  // current. Deliberately not state: it is only meaningful within a live update cycle, so a
  // clone starting over at zero is correct.
  private _generation = 0;

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const hasResolvedNonEmptyBefore = this.state.options.length > 0;

    const options$ = super.getValueOptions(args);

    if (!hasResolvedNonEmptyBefore) {
      return options$;
    }

    const generation = ++this._generation;

    return options$.pipe(
      switchMap((options) => {
        // Non-empty resolutions stay synchronous, matching CustomVariable. Only the reset
        // needs deferring, so an ordinary value change is unaffected.
        if (options.length > 0) {
          return of(options);
        }

        // Cleared synchronously, before returning, so a resolution that starts before the
        // deferred emission below lands does not read a flag this call set and revert its
        // own result. Clearing unconditionally, including when the flag was already set:
        // once a dependency has resolved and then gone empty, a value restored from the URL
        // is itself stale, since it was written before the dependency cleared.
        this.skipNextValidation = false;

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
          filter(() => generation === this._generation)
        );
      })
    );
  }
}
