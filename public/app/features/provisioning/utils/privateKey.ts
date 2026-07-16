const PEM_BLOCK_REGEX = /^(-----BEGIN [A-Z0-9 ]+-----)\s+([\s\S]*?)\s+(-----END [A-Z0-9 ]+-----)$/;

function decodeBase64Pem(value: string): string | undefined {
  if (value.includes('-----BEGIN')) {
    return undefined;
  }

  try {
    const decoded = atob(value);
    return decoded.includes('-----BEGIN') ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function normalizePemPrivateKey(privateKey: string): string {
  const decoded = decodeBase64Pem(privateKey.trim());
  const value = (decoded ?? privateKey).trim().replace(/\\r\\n|\\n|\\r/g, '\n');
  const match = value.match(PEM_BLOCK_REGEX);

  if (!match) {
    return value;
  }

  const [, header, body, footer] = match;
  return [header, body.trim().replace(/\s+/g, '\n'), footer].join('\n');
}
