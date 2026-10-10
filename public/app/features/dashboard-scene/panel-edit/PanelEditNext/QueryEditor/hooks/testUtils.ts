import { type DataFrame } from '@grafana/data';
import { type DataTopic } from '@grafana/schema';

import { type Transformation } from '../types';

export function makeTransformation(id: string, topic?: DataTopic): Transformation {
  return { transformId: id, transformConfig: { id, options: {}, topic }, registryItem: undefined };
}

/** Named frames, so an assertion can say which frame reached an editor rather than how many did. */
export function makeFrames(names: string[]): DataFrame[] {
  return names.map((name) => ({ name, fields: [], length: 0 }));
}
