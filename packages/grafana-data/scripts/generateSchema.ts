import fs from 'node:fs';
import path from 'node:path';
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

console.log('Successfully generated theme schema');
