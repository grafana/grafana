export function assignModelProperties(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  defaults: Record<string, unknown>,
  removeDefaults?: undefined
) {
  for (const key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}
