import { applyStep } from './api';
import { PluginRecipeAction, PluginRecipe, PluginRecipeStep, StepStatus } from './types';

// Finds the steps that can be auto-applied starting from a certain index
// (It is used to automatically apply steps that don't need a user action, but stop when a user action is needed)
export const getAutoApplicapleStepIndexes = (recipe?: PluginRecipe, fromStepIndex = 0) => {
  if (!recipe) {
    return [];
  }

  const stepIds = [];

  for (const [i, step] of recipe.steps.slice(fromStepIndex).entries()) {
    if (step.action === PluginRecipeAction.DisplayInfo || step.action === PluginRecipeAction.Prompt) {
      break;
    }

    stepIds.push(i + fromStepIndex);
  }
  return stepIds;
};

// Can be used to either start or continue an install process
export const installRecipe = async (recipe?: PluginRecipe, fromStepIndex = 0) => {
  if (!recipe) {
    return;
  }

  const autoApplicableStepIndexes = getAutoApplicapleStepIndexes(recipe, fromStepIndex);
  await Promise.all(autoApplicableStepIndexes.map((index) => applyStep(recipe.id, index)));
};

export const findActiveStepIndex = (steps: PluginRecipeStep[] = []): number => {
  const activeStep = steps.find((step) => step.status.code !== StepStatus.Completed);

  // No active step, point to the first step
  if (!activeStep) {
    return 0;
  }

  return steps.indexOf(activeStep);
};

export const isStepCompleted = (step: PluginRecipeStep) => step.status.code === StepStatus.Completed;

export const isStepNotCompleted = (step: PluginRecipeStep) => step.status.code === StepStatus.NotCompleted;

export const isStepLoading = (step: PluginRecipeStep) => step.status.code === StepStatus.Loading;

export const isStepError = (step: PluginRecipeStep) => step.status.code === StepStatus.Error;

export const isStepExpandable = (step: PluginRecipeStep) =>
  step.action === PluginRecipeAction.Prompt || step.action === PluginRecipeAction.DisplayInfo;

const isStepActive = (recipe: PluginRecipe, stepIndex: number) => stepIndex === findActiveStepIndex(recipe.steps);

export const isStepExpanded = (recipe: PluginRecipe, stepIndex: number) =>
  isStepActive(recipe, stepIndex) &&
  isStepNotCompleted(recipe.steps[stepIndex]) &&
  isStepExpandable(recipe.steps[stepIndex]);
