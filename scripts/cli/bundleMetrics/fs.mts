import { readFile } from 'node:fs/promises';

export async function readOptionalJson<T>(filePath: string): Promise<T | undefined> {
  const contents = await readOptionalFile(filePath);
  return contents === undefined ? undefined : JSON.parse(contents);
}

export async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
