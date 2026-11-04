/**
 * Engine labels start in lowercase when they are written to also fit mid-sentence ("the 2nd unnamed panel
 * in the 'DB' tab"); as a header or list item they start with a capital. Quotes and digits are kept as is.
 */
export function capitalizeLabel(label: string): string {
  const [first = ''] = label;
  if (!/^\p{L}$/u.test(first)) {
    return label;
  }
  return first.toLocaleUpperCase() + label.slice(first.length);
}
