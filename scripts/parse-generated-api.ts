const fs = require('fs');
const path = require('path');

// Read the content of the file
const filePath = path.resolve(__dirname, '../public/app/features/provisioning/api/endpoints.gen.ts');
const outputFilePath = path.resolve(__dirname, '../public/app/features/provisioning/api/endpoints.ts');
const content = fs.readFileSync(filePath, 'utf-8');

// Define the prefixes to remove
const prefixes = [
  'ComGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1',
  'ComGithubGrafanaGrafanaPkgApimachineryApisCommonV0Alpha1',
  'IoK8SApimachineryPkgApisMetaV1',
  'IoK8SApimachineryPkgRuntimeRaw',
];

// Function to create a regex for each prefix
const createPrefixRegex = (prefixes: string[]): RegExp => {
  return new RegExp(prefixes.join('|'), 'g');
};

// Function to remove duplicate types from union type definitions
const removeDuplicateTypes = (typeDef: string): string => {
  const typeSet = new Set(typeDef.split('|').map((type) => type.trim()));
  return Array.from(typeSet).join(' | ');
};

// Perform transformations
const transformedContent = content
  // Remove comments (block comments and line comments)
  .replace(/(?:\/\*\*[\s\S]*?\*\/)|(?:\/\/.*)/g, '')

  // Remove namespace property from all types
  .replace(/namespace: string;/g, '')

  // Remove any lines that are now just whitespace or empty
  .replace(/^\s*[\r\n]/gm, '')

  // Remove specified prefixes
  .replace(createPrefixRegex(prefixes), '')

  // Remove the specific URL segment
  .replace(/\/apis\/provisioning\.grafana\.app\/v0alpha1\/namespaces\/\$\{queryArg\['namespace']}/g, '')

  // Replace lowercase 'com' prefix specific match with 'body'
  .replace(/\bcomGithubGrafanaGrafanaPkgApisProvisioningV0Alpha1[A-Za-z0-9_]*/g, 'body')

  // Replace ioK8SApimachineryPkgApisMetaV1 prefix specific match with 'body'
  .replace(/\bioK8SApimachineryPkgApisMetaV1[A-Za-z0-9_]*/g, 'body')

  // Remove duplicate types in union type definitions
  .replace(/(export type [A-Za-z0-9]+ = [^;]+);/g, (match: string, typeDef: string) => {
    return `${removeDuplicateTypes(typeDef)};`;
  });

  // Modify any 'List...Arg>' to 'List...Arg | void>'
  // FIXME: We do field accesses on these types. This breaks compilation. It's more convenient to just pass {} to these call sites than deal with it (for now?).
  // .replace(/(List[A-Za-z0-9]+Arg)>/g, '$1 | void>');

// Write the transformed content back to a new file
fs.writeFileSync(outputFilePath, transformedContent);

console.log('Transformation complete! Check the transformed file at:', outputFilePath);