import { applyStep } from './api';
import { PluginRecipeAction, PluginRecipe } from './types';

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
