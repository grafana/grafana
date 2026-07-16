import { normalizePemPrivateKey } from './privateKey';

const normalizedPem = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEpAIBAAKCAQEA123',
  'abc456',
  '-----END RSA PRIVATE KEY-----',
].join('\n');

describe('normalizePemPrivateKey', () => {
  it('keeps multiline PEM content unchanged', () => {
    expect(normalizePemPrivateKey(normalizedPem)).toBe(normalizedPem);
  });

  it('converts literal newline escapes to multiline PEM content', () => {
    const escapedPem = normalizedPem.replace(/\n/g, '\\n');

    expect(normalizePemPrivateKey(escapedPem)).toBe(normalizedPem);
  });

  it('restores PEM separators when newlines were flattened to spaces', () => {
    const spaceFlattenedPem =
      '-----BEGIN RSA PRIVATE KEY----- MIIEpAIBAAKCAQEA123 abc456 -----END RSA PRIVATE KEY-----';

    expect(normalizePemPrivateKey(spaceFlattenedPem)).toBe(normalizedPem);
  });

  it('accepts base64-encoded PEM content', () => {
    expect(normalizePemPrivateKey(btoa(normalizedPem))).toBe(normalizedPem);
  });
});
