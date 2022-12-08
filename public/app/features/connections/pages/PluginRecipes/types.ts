export type PluginRecipe = {
  id: string;
  name: string;
  logo: string;
  summary: string;
  description?: string;
  steps: PluginRecipeStep[];
};

export type PluginRecipeStep<T = unknown> = {
  action: 'install-plugin' | 'display-info' | 'setup-dashboard' | 'prompt' | 'setup-alerts' | 'install-agent';
  name: string;
  description: string;
  settings: T;
  status: {
    code: StepStatus;
    message?: string;
  };
};

export enum StepStatus {
  Completed = 'Completed',
  NotCompleted = 'NotCompleted',
  Error = 'Error',
}

export type Screenshot = { name: string; url: string };

// Step - Install Plugin
// ---------------------
export type InstallPluginStepSettings = {
  plugin: {
    id: string;
    version: string;
  };
};

// Step - Prompt
// --------------
export type PromptStepSettings = {
  prompts: PluginRecipePrompt[];
};

export type PluginRecipePrompt = {
  label: string;
  description: string;
  type: string; // 'text', 'number', 'select', 'multiselect', 'radio'
  placeholder: string;
  defaultValue: string;
  options: Array<{
    name: string;
    value: string;
  }>;
};

// Step - Instruction
// -----------------
export type InstructionStepSettings = {
  instructionText: string; // The text of the instructions as Markdown
  instructionTestURL: string; // The URL to run the health-check against
  instructionTestExpectedHttpResponse: string; // The expected healthy HTTP response code (e.g. "200")
};

// Step - Dashboard
// -----------------
export type SetupDashboardStepSettings = {
  screenshots: Screenshot[];
};

// Step - Alerts
// -----------------
export type RecipeAlertRule = {
  namespace: string;
  group: string;
  name: string;
  summary: string;
};

export type SetupAlertsStepSettings = {
  alerts: RecipeAlertRule[];
};

// Step - Agent
// -----------------
export type RecipeMetric = {
  name: string;
  type?: string;
  description?: string;
};

export type InstallAgentStepSettings = {
  metrics: RecipeMetric[];
};

export function isSetupDashboardStep(step: PluginRecipeStep): step is PluginRecipeStep<SetupDashboardStepSettings> {
  return step.action === 'setup-dashboard';
}

export function isInstrucitonStep(step: PluginRecipeStep): step is PluginRecipeStep<InstructionStepSettings> {
  return step.action === 'display-info';
}

export function isPromptStep(step: PluginRecipeStep): step is PluginRecipeStep<PromptStepSettings> {
  return step.action === 'prompt';
}

export function isInstallPluginStep(step: PluginRecipeStep): step is PluginRecipeStep<InstallPluginStepSettings> {
  return step.action === 'install-plugin';
}

export function isSetupAlertsStep(step: PluginRecipeStep): step is PluginRecipeStep<SetupAlertsStepSettings> {
  return step.action === 'setup-alerts';
}

export function isInstallAgentStep(step: PluginRecipeStep): step is PluginRecipeStep<InstallAgentStepSettings> {
  return step.action === 'install-agent';
}
