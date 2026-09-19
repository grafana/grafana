import { type Observable, asapScheduler, filter, observeOn, of, switchMap } from 'rxjs';

import { CustomVariable, type VariableGetOptionsArgs, type VariableValueOption } from '@grafana/scenes';

// CustomVariable sets skipNextValidation = true whenever its interpolated query resolves to
// zero options (scenes PR #1033), which makes interceptStateUpdateAfterValidation revert the
// computed update. That guard is meant for a static query producing no options whose value
// arrived from the URL, so the URL value survives validation. It should not apply when the
// query interpolates another variable: there, zero options means the dependency cleared, and
// reverting suppresses a legitimate reset.
//
// The dependency set separates the two cases. A static query such as "1, 2" has none, so the
// guard still protects it; "${__scopes}" has one, so validation is allowed to proceed.
export class ResettingCustomVariable extends CustomVariable {
  // Identifies the most recent resolution. A deferred reset from a superseded one must not
  // land, so it carries the generation it was issued for and drops if that is no longer
  // current. Deliberately not state: it is only meaningful within a live update cycle, so a
  // clone starting over at zero is correct.
  private _generation = 0;

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    const dependsOnVariables = (this.variableDependency?.getNames()?.size ?? 0) > 0;

    // Bumped on every call, including the static path below. Any resolution supersedes an
    // earlier pending one, and a query edited to drop its dependency has to invalidate a
    // reset scheduled while that dependency was still there.
    const generation = ++this._generation;

    const options$ = super.getValueOptions(args);

    if (!dependsOnVariables) {
      return options$;
    }

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
