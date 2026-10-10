import { type Observable, asapScheduler, filter, observeOn, of, switchMap } from 'rxjs';

import { CustomVariable, type VariableGetOptionsArgs, type VariableValueOption } from '@grafana/scenes';

// Delays the reset of a variable whose query interpolates another variable, so it lands after
// the state change that triggered it has finished propagating. ScopesService notifies its
// consumers before writing its own URL state, and its URL listener re-applies any scope it
// still sees in the URL. Resetting synchronously therefore writes var-<name> while the stale
// scopes param is still present, and the scope removal gets undone. DashboardReloadBehavior
// delays for the same reason.
//
// This exists only to work around that ordering. Delete it once scopes state management no
// longer depends on consumers leaving the URL alone mid-transition.
export class ResettingCustomVariable extends CustomVariable {
  // Identifies the most recent resolution. A deferred reset from a superseded one must not
  // land, so it carries the generation it was issued for and drops if that is no longer
  // current. Deliberately not state: it is only meaningful within a live update cycle, so a
  // clone starting over at zero is correct.
  private _generation = 0;

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    // Only a query with a dependency produces a reset that writes to the URL, so only those
    // need delaying. A static query resolving to nothing keeps its value and writes nothing.
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

        // Defence in depth. MultiValueUrlSyncHandler.updateFromUrl also sets this flag, for
        // any variable inactive at URL-sync time and regardless of its dependencies, so the
        // dependency condition in CustomVariable does not cover that producer. Only the empty
        // case clears it, so a non-empty resolution still lets the URL-value protection stand.
        this.skipNextValidation = false;

        return of(options).pipe(
          // One microtask is enough, since the delay only has to outlast the synchronous
          // notification that triggered this reset. The class comment explains why that
          // matters.
          observeOn(asapScheduler),
          filter(() => generation === this._generation)
        );
      })
    );
  }
}
