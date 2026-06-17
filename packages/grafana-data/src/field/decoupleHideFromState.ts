import { getFieldMatcher } from '../transformations/matchers';
import { type DataFrame } from '../types/dataFrame';
import { type FieldConfigSource } from '../types/fieldOverrides';

/**
 *
 * moves each field's config.custom.hideFrom to field.state.hideFrom
 * and mutates original field.config.custom.hideFrom to one with explicit overrides only, (without the ad-hoc stateful __system override from legend toggle)
 */
export function decoupleHideFromState(frames: DataFrame[], fieldConfig: FieldConfigSource) {
  frames.forEach((frame) => {
    frame.fields.forEach((field) => {
      const hideFrom = {
        legend: false,
        tooltip: false,
        viz: false,
        ...fieldConfig.defaults.custom?.hideFrom,
      };

      // with ad hoc __system override applied
      const hideFromState = field.config.custom?.hideFrom;

      fieldConfig.overrides.forEach((o) => {
        if ('__systemRef' in o) {
          return;
        }

        const m = getFieldMatcher(o.matcher);

        if (m(field, frame, frames)) {
          for (const p of o.properties) {
            if (p.id === 'custom.hideFrom') {
              Object.assign(hideFrom, p.value);
            }
          }
        }
      });

      field.state = {
        ...field.state,
        hideFrom: {
          ...hideFromState,
        },
      };

      // original with perm overrides
      field.config.custom = field.config.custom ?? {};
      field.config.custom.hideFrom = hideFrom;
    });
  });
}
