export function addTransformTransition(transitions: string[]) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) {
    transitions.push('transform');
  }

  return transitions;
}
