export function assignModelProperties(target: any, source: any, defaults: any, removeDefaults?: undefined) {
  for (const key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}
