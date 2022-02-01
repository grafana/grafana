export function isSoloRoute(path: string): boolean {
  return /(d-solo|dashboard-solo)/.test(path?.toLowerCase());
}
