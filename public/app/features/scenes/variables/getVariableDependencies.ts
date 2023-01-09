import { variableRegex } from 'app/features/variables/utils';

export function getVariableDependencies(stringToCheck: string): string[] {
  variableRegex.lastIndex = 0;

  const matches = stringToCheck.matchAll(variableRegex);
  if (!matches) {
    return [];
  }

  const dependencies: string[] = [];

  for (const match of matches) {
    const [, var1, var2, , var3] = match;
    const variableName = var1 || var2 || var3;
    dependencies.push(variableName);
  }

  return dependencies;
}
