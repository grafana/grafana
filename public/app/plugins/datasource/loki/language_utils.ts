export function roundMsToMin(milliseconds: number): number {
  return roundSecToMin(milliseconds / 1000);
}

export function roundSecToMin(seconds: number): number {
  return Math.floor(seconds / 60);
}
