import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { NewThemeOptionsSchema } from '../createTheme';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

fs.writeFileSync(
  path.join(__dirname, '../schema.generated.json'),
  JSON.stringify(
    NewThemeOptionsSchema.toJSONSchema({
      target: 'draft-07',
    }),
    undefined,
    2
  )
);
