import path from 'path';
import { OwnershipEngine } from 'github-codeowners/dist/lib/ownership/index.js';

const CODEOWNERS_PATH = path.resolve('.github/CODEOWNERS');

let engine: { calcFileOwnership(filePath: string): string[] } | null = null;

const getEngine = (): { calcFileOwnership(filePath: string): string[] } => {
  engine ??= OwnershipEngine.FromCodeownersFile(CODEOWNERS_PATH);
  return engine;
};

/**
 * Returns the owners for the given file path (relative to repo root, no leading slash).
 * Uses the same OwnershipEngine as the CI/CD codeowners tooling.
 * Returns undefined when no rule matches.
 */
export const resolveOwner = (relativeFilePath: string): string | undefined => {
  const owners: string[] = getEngine().calcFileOwnership(relativeFilePath);
  return owners.length > 0 ? owners.join(', ') : undefined;
};
