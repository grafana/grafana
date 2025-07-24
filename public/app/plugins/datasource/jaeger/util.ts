import logfmt from 'logfmt';

export function transformToLogfmt(tags: string | undefined) {
  if (!tags) {
    return '';
  }
  try {
    return logfmt.stringify(JSON.parse(tags));
  } catch {
    return tags;
  }
}
