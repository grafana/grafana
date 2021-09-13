export function isSoloRoute(path: string): boolean {
  return path?.toLowerCase().includes('/d-solo/');
}
