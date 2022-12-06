export type PluginRecipe = {
  id: string;
  name: string;
  meta: PluginRecipeMeta;
  steps: PluginRecipeStep[];
};

export type PluginRecipeMeta = {
  logo?: string;
  summary?: string;
  description?: string;
};

export type PluginRecipeStep = {
  action: 'install-plugin' | 'display-info' | 'setup-dashboard';

  // Meta information about the step (Optional)
  meta?: PluginRecipeStepMeta;

  // Information about the plugin to be installed (Only needed if the step is for installing a plugin)
  plugin?: {
    id: string;
    version: string;
  };

  // Optional information about the status of this recipe step
  status?: {
    status: string;
    statusMessage: string;
  };
};

export type PluginRecipeStepMeta = {
  name?: string;
  description?: string;
};

// Setup dashboard step specifics
export type Screenshot = { name: string; url: string };

export type PluginRecipeSetupDashboardStepMeta = PluginRecipeStepMeta & {
  screenshots: Screenshot[];
};

export type PluginRecipeSetupDashboardStep = PluginRecipeStep & {
  meta?: PluginRecipeSetupDashboardStepMeta;
};

export function isSetupDashboardStep(step: PluginRecipeStep): step is PluginRecipeSetupDashboardStep {
  return step.action === 'setup-dashboard';
}
