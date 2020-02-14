import { FieldConfigEditorRegistry, FieldPropertyEditorItem } from '../types/fieldOverrides';
import { Registry } from '../utils/Registry';

export const standardFieldConfigEditorRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>();
