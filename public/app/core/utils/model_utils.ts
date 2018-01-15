export function assignModelProperties(target, source, defaults, removeDefaults?) {
  for (var key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}
