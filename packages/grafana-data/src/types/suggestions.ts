import { DataFrame, PanelPlugin, VariableModel, VariableSuggestion, VariableSuggestionsScope } from '..';

export type SuggestionsProvider = (
  plugin: PanelPlugin,
  data: DataFrame[],
  getTemplateVariables: () => VariableModel[],
  scope?: VariableSuggestionsScope
) => VariableSuggestion[];
