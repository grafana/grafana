import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { NewThemeOptionsSchema } from '../src/themes/createTheme';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'themes', 'schema.generated.json'),
  JSON.stringify(
    NewThemeOptionsSchema.toJSONSchema({
      target: 'draft-07',
    }),
    undefined,
    2
  )
);

console.log('Successfully generated theme schema');
