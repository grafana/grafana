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
  action: string;

  // Meta information about the step (Optional)
  meta?: {
    name?: string;
    description?: string;
  };

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
