import { compileFromFile } from 'json-schema-to-typescript';
import fs from 'node:fs';
import path from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { NewThemeOptionsSchema } from '../src/themes/createTheme';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonOut = path.join(__dirname, '..', 'src', 'themes', 'schema.generated.json');

fs.writeFileSync(
  jsonOut,
  JSON.stringify(
    NewThemeOptionsSchema.toJSONSchema({
      target: 'draft-07',
    }),
    undefined,
    2
  )
);

if (argv.includes('--declaration')) {
  compileFromFile(jsonOut).then((ts: string | NodeJS.ArrayBufferView<ArrayBufferLike>) =>
    fs.writeFileSync(path.join(__dirname, '..', 'dist', 'types', 'themes', 'schema.generated.json.d.ts'), ts)
  );
}

console.log('Successfully generated theme schema');
