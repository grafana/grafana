import logfmt from 'logfmt';

export function convertTagsLogfmt(tags: string | undefined) {
  if (!tags) {
    return '';
  }
  const data: any = logfmt.parse(tags);
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (typeof value !== 'string') {
      data[key] = String(value);
    }
  });
  return JSON.stringify(data);
}

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
