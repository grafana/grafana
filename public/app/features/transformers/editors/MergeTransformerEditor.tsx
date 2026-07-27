import { type TransformerUIProps } from '@grafana/data';
import { type MergeTransformerOptions } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { FieldValidationMessage } from '@grafana/ui';

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
