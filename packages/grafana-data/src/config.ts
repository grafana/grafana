import { FeatureToggles } from './types';

let featureToggles: FeatureToggles;

export function setFeatureToggles(newFeatureToggles: FeatureToggles) {
  featureToggles = newFeatureToggles;
}

export function getFeatureToggles() {
  return featureToggles || {};
}
