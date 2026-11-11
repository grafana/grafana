import {
  type DataFrame,
  DataLinkBuiltInVars,
  ReducerID,
  VariableOrigin,
  type VariableSuggestion,
  VariableSuggestionsScope,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { RenderMode } from '../panelcfg.gen';

import { isTextNewFeaturesEnabled } from './utils';

/**
 * Editor suggestions, including the ${__value} macros.
 *
 * Once mode has no row, so field macros get a reducer and ${__value.time}, which is always
 * empty there, is left out.
 */
export function getTextVariableSuggestions(series: DataFrame[], renderMode?: RenderMode): VariableSuggestion[] {
  const suggestions = getDataLinksVariableSuggestions(series, VariableSuggestionsScope.Values);

  if (!isTextNewFeaturesEnabled() || renderMode === RenderMode.PerRow) {
    return suggestions;
  }

  return suggestions
    .filter((suggestion) => suggestion.value !== DataLinkBuiltInVars.valueTime)
    .map((suggestion) =>
      suggestion.origin === VariableOrigin.Fields
        ? {
            ...suggestion,
            value: `${suggestion.value}:reduce:${ReducerID.lastNotNull}`,
            documentation: t(
              'textng.variable-suggestions.reduced-field',
              'Last non-null value of the field. Replace lastNotNull with another reducer, such as mean or max.'
            ),
          }
        : suggestion
    );
}
