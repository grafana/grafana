// remove identifier quoting from identifier to use in metadata queries
export function unquoteIdentifier(value: string) {
  if (value[0] === '"' && value[value.length - 1] === '"') {
    return value.substring(1, value.length - 1).replace(/""/g, '"');
  } else if (value[0] === '`' && value[value.length - 1] === '`') {
    return value.substring(1, value.length - 1);
  } else {
    return value;
  }
}
export function quoteLiteral(value: string) {
  return "'" + value.replace(/'/g, "''") + "'";
}
