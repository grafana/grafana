export function assignModelProperties(
  target: any,
  source: any,
  defaults: { [x: string]: any; propB?: number; propC?: number; hasOwnProperty?: any },
  removeDefaults?: undefined
) {
  for (const key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}
