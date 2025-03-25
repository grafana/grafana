import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';
import { MergeTransformerOptions } from '@grafana/data/internal';
import { FieldValidationMessage } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

export const MergeTransformerEditor = ({ input, options, onChange }: TransformerUIProps<MergeTransformerOptions>) => {
  if (input.length <= 1) {
    // Show warning that merge is useless only apply on a single frame
    return (
      <FieldValidationMessage>
        <Trans i18nKey="transformers.merge-transformer-editor.merge-effect-applied-single-frame">
          Merge has no effect when applied on a single frame.
        </Trans>
      </FieldValidationMessage>
    );
  }
  return null;
};

export const mergeTransformerRegistryItem: TransformerRegistryItem<MergeTransformerOptions> = {
  id: DataTransformerID.merge,
  editor: MergeTransformerEditor,
  transformation: standardTransformers.mergeTransformer,
  name: standardTransformers.mergeTransformer.name,
  description: `Merge many series/tables and return a single table where mergeable values will be combined into the same row.
                Useful for showing multiple series, tables or a combination of both visualized in a table.`,
  categories: new Set([TransformerCategory.Combine]),
  help: getTransformationContent(DataTransformerID.merge).helperDocs,
};
